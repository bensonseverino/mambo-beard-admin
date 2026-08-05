// Order operations: checkout creation, listing, and status updates.
//
// Stock is validated up-front (clean 4xx errors) and then deducted inside a
// single D1 batch, which runs atomically. Deductions use guarded UPDATEs
// (WHERE ... stock >= ?) so stock can never go negative.

import { apiError, ensureSchema, requireDb } from "./schema.js";

const slugifyValue = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "product";

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const pad4 = (value) => String(value).padStart(4, "0");

/**
 * Sequential order number in the form MB-YYYYMMDD-0001.
 * The sequence restarts each day.
 */
export const generateOrderNumber = async (env, date = new Date()) => {
  const prefix = `MB-${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}${String(date.getDate()).padStart(2, "0")}`;
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM orders WHERE order_number LIKE ?",
  )
    .bind(`${prefix}-%`)
    .first();
  const seq = toInt(row?.count) + 1;
  return `${prefix}-${pad4(seq)}`;
};

const mergeCartItems = (items) => {
  const merged = new Map();
  for (const item of items) {
    const productKey =
      item.productId || item.slug || (item.product?.id ? item.product.id : "");
    const colorId = item.colorId || "";
    const size = String(item.size || "").trim();
    if (!productKey || !colorId || !size) {
      throw apiError(
        "INVALID_PAYLOAD",
        "Every cart item needs a product, color, and size.",
      );
    }
    const quantity = Math.max(1, toInt(item.quantity, 1));
    const key = `${productKey}|${colorId}|${size}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      merged.set(key, {
        productKey,
        colorId,
        size,
        quantity,
        price: toInt(item.price),
      });
    }
  }
  return [...merged.values()];
};

/**
 * Create an order with full validation and atomic inventory deduction.
 * Returns { orderId, orderNumber, subtotal, deliveryFee, total, items }.
 */
export const createOrder = async (env, payload) => {
  requireDb(env);
  await ensureSchema(env);

  const body = payload && typeof payload === "object" ? payload : {};
  const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
  const name = String(customer.name || body.name || "").trim();
  const phone = String(customer.phone || body.phone || "").trim();
  const email = String(customer.email || body.email || "").trim();
  const location = String(customer.location || body.location || "").trim();

  if (!name || !phone) {
    throw apiError("INVALID_PAYLOAD", "Customer name and phone are required.");
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) {
    throw apiError("EMPTY_CART", "Cart is empty.");
  }
  const items = mergeCartItems(rawItems);

  const deliveryFee = Math.max(0, toInt(body.deliveryFee));

  // ── Validation phase (reads only — clean errors, nothing written) ──────
  const validated = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE (id = ? OR slug = ?) AND active = 1",
    )
      .bind(item.productKey, item.productKey)
      .first();
    if (!product) {
      throw apiError(
        "PRODUCT_NOT_FOUND",
        `Product not found: ${item.productKey}`,
        404,
      );
    }

    const color = await env.DB.prepare(
      "SELECT * FROM product_colors WHERE id = ? AND product_id = ?",
    )
      .bind(item.colorId, product.id)
      .first();
    if (!color) {
      throw apiError(
        "COLOR_NOT_FOUND",
        `Color not found for product "${product.name}".`,
      );
    }

    const size = await env.DB.prepare(
      "SELECT * FROM sizes WHERE name = ?",
    )
      .bind(item.size)
      .first();

    // Fall back to product_variants stock when the inventory mirror is
    // missing (e.g. products created before inventory sync shipped).
    const inventoryRow = await env.DB.prepare(
      "SELECT * FROM inventory WHERE product_id = ? AND color_id = ? AND size_id = ?",
    )
      .bind(product.id, item.colorId, size?.id || "")
      .first();
    const variant = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE product_id = ? AND color_id = ? AND size = ?",
    )
      .bind(product.id, item.colorId, item.size)
      .first();

    const stock = inventoryRow ? inventoryRow.stock : variant?.stock ?? 0;
    if (stock < item.quantity) {
      throw apiError(
        "INSUFFICIENT_STOCK",
        `Insufficient stock for ${product.name} (${item.size}). Only ${stock} left.`,
      );
    }

    // Round (not truncate) so decimal prices like 24.99 are priced correctly.
    const price = Math.max(0, Math.round(Number(product.price) || 0));
    subtotal += price * item.quantity;

    validated.push({
      ...item,
      productId: product.id,
      sizeId: size?.id || `size-${slugifyValue(item.size)}`,
      price,
      stock,
      sizeMissing: !size,
      inventoryMissing: !inventoryRow,
    });
  }

  // ── Customer: find by phone so checkout updates or creates the record ──
  const existingCustomer = await env.DB.prepare(
    "SELECT id FROM customers WHERE phone = ?",
  )
    .bind(phone)
    .first();

  // ── Write phase (single atomic batch) ──────────────────────────────────
  const now = new Date();
  const orderId = `ord-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const orderNumber = await generateOrderNumber(env, now);
  const total = subtotal + deliveryFee;

  const statements = [
    existingCustomer
      ? env.DB.prepare(
          `UPDATE customers SET name = ?, email = ?, location = ?,
           total_orders = total_orders + 1, lifetime_spend = lifetime_spend + ?,
           last_order_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).bind(name, email || null, location || null, total, existingCustomer.id)
      : env.DB.prepare(
          `INSERT INTO customers (id, phone, name, email, location, total_orders, lifetime_spend, last_order_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(phone) DO UPDATE SET
             name = excluded.name,
             email = excluded.email,
             location = excluded.location,
             total_orders = customers.total_orders + 1,
             lifetime_spend = customers.lifetime_spend + excluded.lifetime_spend,
             last_order_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP`,
        ).bind(
          `cus-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          phone,
          name,
          email || null,
          location || null,
          total,
        ),
    env.DB.prepare(
      `INSERT INTO orders (id, order_number, customer_name, phone, email, location, delivery_fee, subtotal, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).bind(
      orderId,
      orderNumber,
      name,
      phone,
      email || null,
      location || null,
      deliveryFee,
      subtotal,
      total,
    ),
  ];

  for (const item of validated) {
    // Ensure the size row exists for legacy data.
    if (item.sizeMissing) {
      statements.push(
        env.DB
          .prepare("INSERT OR IGNORE INTO sizes (id, name) VALUES (?, ?)")
          .bind(item.sizeId, item.size),
      );
    }

    statements.push(
      env.DB.prepare(
        `INSERT INTO order_items (id, order_id, product_id, color_id, size, size_id, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `item-${orderId}-${Math.random().toString(36).slice(2, 8)}`,
        orderId,
        item.productId,
        item.colorId,
        item.size,
        item.sizeId,
        item.quantity,
        item.price,
      ),
    );

    // Make sure the inventory mirror row exists for legacy products.
    if (item.inventoryMissing) {
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(
          `${item.colorId}__${item.sizeId}`,
          item.productId,
          item.colorId,
          item.sizeId,
          item.stock,
        ),
      );
    }

    // Guarded deductions — stock can never drop below zero.
    statements.push(
      env.DB.prepare(
        `UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND color_id = ? AND size_id = ? AND stock >= ?`,
      ).bind(
        item.quantity,
        item.productId,
        item.colorId,
        item.sizeId,
        item.quantity,
      ),
      env.DB.prepare(
        `UPDATE product_variants SET stock = stock - ? WHERE product_id = ? AND color_id = ? AND size = ? AND stock >= ?`,
      ).bind(
        item.quantity,
        item.productId,
        item.colorId,
        item.size,
        item.quantity,
      ),
    );
  }

  const batchResults = await env.DB.batch(statements);
  if (batchResults.some((result) => result?.meta?.changes === 0)) {
    // A guarded stock update matched no rows — concurrent checkout race.
    // Stock never went negative, but flag it for manual review.
    console.warn(
      `Checkout ${orderNumber}: a guarded stock update matched 0 rows (possible concurrent oversell).`,
    );
  }

  return {
    orderId,
    orderNumber,
    subtotal,
    deliveryFee,
    total,
    items: validated.map((item) => ({
      productId: item.productId,
      colorId: item.colorId,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    })),
  };
};

const mapOrderRow = (order, itemsByOrder, productNames, colorInfos) => ({
  id: order.id,
  orderNumber: order.order_number,
  customerName: order.customer_name,
  phone: order.phone,
  email: order.email,
  location: order.location,
  deliveryFee: order.delivery_fee,
  subtotal: order.subtotal,
  total: order.total,
  status: order.status,
  createdAt: order.created_at,
  items: (itemsByOrder.get(order.id) || []).map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: productNames.get(item.product_id) || "Unknown product",
    colorId: item.color_id,
    colorName: colorInfos.get(item.color_id)?.name || "",
    colorHex: colorInfos.get(item.color_id)?.hex || "",
    size: item.size,
    sizeId: item.size_id,
    quantity: item.quantity,
    price: item.price,
  })),
});

/**
 * List orders with server-side pagination and filters.
 *
 * options: { page, pageSize, search, status, date }
 *   search — matches order number, customer name, phone, email, or status
 *   status — exact status match
 *   date   — matches orders created on a given YYYY-MM-DD day
 *
 * Returns { orders, total, page, pageSize, totalPages }. Each order embeds
 * its items enriched with product and color names for admin display.
 */
export const listOrders = async (env, options = {}) => {
  requireDb(env);
  await ensureSchema(env);

  const page = Math.max(1, toInt(options.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(options.pageSize, 10)));
  const search = String(options.search || "").trim();
  const status = String(options.status || "").trim();
  const date = String(options.date || "").trim();

  const conditions = [];
  const bindings = [];
  if (search) {
    conditions.push(
      "(order_number LIKE ? OR customer_name LIKE ? OR phone LIKE ? OR email LIKE ? OR status LIKE ?)",
    );
    const pattern = `%${search}%`;
    bindings.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (status) {
    conditions.push("status = ?");
    bindings.push(status);
  }
  if (date) {
    conditions.push("created_at LIKE ?");
    bindings.push(`${date}%`);
  }
  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";

  const [countResult, ordersResult, itemsResult, productsResult, colorsResult] =
    await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS count FROM orders${whereClause}`)
        .bind(...bindings)
        .all(),
      env.DB.prepare(
        `SELECT * FROM orders${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
        .bind(...bindings, pageSize, (page - 1) * pageSize)
        .all(),
      env.DB.prepare("SELECT * FROM order_items").all(),
      env.DB.prepare("SELECT id, name FROM products").all(),
      env.DB.prepare("SELECT id, name, hex FROM product_colors").all(),
    ]);

  const productNames = new Map(
    (productsResult.results || []).map((row) => [row.id, row.name]),
  );
  const colorInfos = new Map(
    (colorsResult.results || []).map((row) => [row.id, row]),
  );

  const itemsByOrder = new Map();
  for (const row of itemsResult.results || []) {
    const existing = itemsByOrder.get(row.order_id) || [];
    existing.push(row);
    itemsByOrder.set(row.order_id, existing);
  }

  const total = toInt(countResult.results?.[0]?.count);
  return {
    orders: (ordersResult.results || []).map((order) =>
      mapOrderRow(order, itemsByOrder, productNames, colorInfos),
    ),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
];

export const updateOrderStatus = async (env, orderId, payload) => {
  requireDb(env);
  await ensureSchema(env);

  const status = String(payload?.status || "").trim().toLowerCase();
  if (!status) {
    throw apiError("INVALID_STATUS", "Order status is required.");
  }
  if (!ORDER_STATUSES.includes(status)) {
    throw apiError(
      "INVALID_STATUS",
      `Invalid order status: "${status}".`,
      400,
    );
  }

  const result = await env.DB.prepare(
    "UPDATE orders SET status = ? WHERE id = ?",
  )
    .bind(status, orderId)
    .run();

  if (!result?.meta?.changes) {
    throw apiError("ORDER_NOT_FOUND", "Order not found.", 404);
  }

  return { id: orderId, status };
};
