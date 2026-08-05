// Customer operations for the admin dashboard.
//
// Customers are upserted by checkout (find by phone, update or create), so the
// customers table is the single source of truth for the Customers tab.

import { apiError, ensureSchema, requireDb } from "./schema.js";

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const mapCustomerRow = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  location: row.location,
  totalOrders: toInt(row.total_orders),
  lifetimeSpend: toInt(row.lifetime_spend),
  lastOrderAt: row.last_order_at,
  createdAt: row.created_at,
});

/**
 * List customers with server-side pagination and search.
 *
 * options: { page, pageSize, search } — search matches name, phone, or email.
 * Returns { customers, total, page, pageSize, totalPages }.
 */
export const listCustomers = async (env, options = {}) => {
  requireDb(env);
  await ensureSchema(env);

  const page = Math.max(1, toInt(options.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(options.pageSize, 10)));
  const search = String(options.search || "").trim();

  const conditions = [];
  const bindings = [];
  if (search) {
    conditions.push("(name LIKE ? OR phone LIKE ? OR email LIKE ?)");
    const pattern = `%${search}%`;
    bindings.push(pattern, pattern, pattern);
  }
  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";

  const [countResult, listResult] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM customers${whereClause}`)
      .bind(...bindings)
      .all(),
    env.DB.prepare(
      `SELECT * FROM customers${whereClause} ORDER BY lifetime_spend DESC, created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all(),
  ]);

  const total = toInt(countResult.results?.[0]?.count);
  return {
    customers: (listResult.results || []).map(mapCustomerRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

/**
 * Load a single customer with order history, spend stats, and recent
 * purchases. Orders are matched by the customer's phone (the checkout key).
 */
export const getCustomerDetail = async (env, customerId) => {
  requireDb(env);
  await ensureSchema(env);

  const customer = await env.DB
    .prepare("SELECT * FROM customers WHERE id = ?")
    .bind(customerId)
    .first();
  if (!customer) {
    throw apiError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }

  const [ordersResult, itemsResult, productsResult, colorsResult] =
    await Promise.all([
      env.DB.prepare(
        "SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC",
      )
        .bind(customer.phone)
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

  const orderIds = new Set((ordersResult.results || []).map((order) => order.id));
  const itemsByOrder = new Map();
  for (const row of itemsResult.results || []) {
    if (!orderIds.has(row.order_id)) continue;
    const existing = itemsByOrder.get(row.order_id) || [];
    existing.push(row);
    itemsByOrder.set(row.order_id, existing);
  }

  const orders = (ordersResult.results || []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    total: toInt(order.total),
    createdAt: order.created_at,
    items: (itemsByOrder.get(order.id) || []).map((item) => ({
      productId: item.product_id,
      productName: productNames.get(item.product_id) || "Unknown product",
      colorId: item.color_id,
      colorName: colorInfos.get(item.color_id)?.name || "",
      colorHex: colorInfos.get(item.color_id)?.hex || "",
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    })),
  }));

  const totalSpend = toInt(customer.lifetime_spend);
  const orderCount = orders.length;
  const averageOrderValue = orderCount
    ? Math.round(totalSpend / orderCount)
    : 0;

  // Recent purchases: first occurrence of each product/color/size combo
  // across the most recent orders, up to ten unique lines.
  const recentPurchases = [];
  const seen = new Set();
  for (const order of orders) {
    for (const item of order.items) {
      const lineKey = `${item.productId}|${item.colorId || ""}|${item.size || ""}`;
      if (seen.has(lineKey)) continue;
      seen.add(lineKey);
      recentPurchases.push({
        productId: item.productId,
        productName: item.productName,
        colorName: item.colorName,
        colorHex: item.colorHex,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        purchasedAt: order.createdAt,
      });
      if (recentPurchases.length >= 10) break;
    }
    if (recentPurchases.length >= 10) break;
  }

  return {
    customer: {
      ...mapCustomerRow(customer),
      totalOrders: orderCount,
      lifetimeSpend: totalSpend,
    },
    orders,
    stats: { totalSpend, orderCount, averageOrderValue },
    recentPurchases,
  };
};
