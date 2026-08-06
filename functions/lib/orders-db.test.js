import test from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { createProduct, listProducts } from "./products-db.js";
import {
  createOrder,
  generateOrderNumber,
  listOrders,
  updateOrderStatus,
} from "./orders-db.js";
import { ensureSchema } from "./schema.js";

const makeEnv = async () => {
  const env = { DB: createFakeD1() };
  await ensureSchema(env);
  return env;
};

const seedProduct = async (env) => {
  await createProduct(env, {
    id: "prod-1",
    name: "Classic Beard Oil",
    slug: "classic-beard-oil",
    description: "A cedar-scented blend.",
    price: 24,
    category: "Care",
    featured: true,
    active: true,
    colors: [
      {
        id: "color-1",
        name: "Amber",
        hex: "#b97a1b",
        images: [],
        variants: [{ size: "M", stock: 5 }],
      },
    ],
  });
};

const basePayload = () => ({
  customer: {
    name: "Jane Doe",
    phone: "+254700000000",
    email: "jane@example.com",
    location: "Westlands",
  },
  items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 2 }],
  deliveryFee: 150,
});

test("ensureSchema creates every table including orders (the D1_ERROR fix)", async () => {
  const env = await makeEnv();
  for (const table of [
    "products",
    "product_colors",
    "product_images",
    "product_variants",
    "sizes",
    "inventory",
    "orders",
    "order_items",
    "customers",
  ]) {
    assert.ok(Array.isArray(env.DB._rows(table)), `${table} should exist`);
  }
});

test("checkout creates order, order items, and reduces inventory atomically", async () => {
  const env = await makeEnv();
  await seedProduct(env);

  const order = await createOrder(env, basePayload());

  assert.match(order.orderId, /^ord-/);
  assert.match(order.orderNumber, /^MB-\d{8}-\d{4}$/);
  assert.equal(order.subtotal, 48); // 24 * 2
  assert.equal(order.deliveryFee, 150);
  assert.equal(order.total, 198);

  // Order + items persisted.
  const orders = env.DB._rows("orders");
  assert.equal(orders.length, 1);
  assert.equal(orders[0].customer_name, "Jane Doe");
  assert.equal(orders[0].status, "pending");
  const items = env.DB._rows("order_items");
  assert.equal(items.length, 1);
  assert.equal(items[0].product_id, "prod-1");
  assert.equal(items[0].size, "M");
  assert.equal(items[0].quantity, 2);

  // Inventory mirrored in both tables, deducted without going negative.
  assert.equal(env.DB._rows("inventory")[0].stock, 3);
  assert.equal(env.DB._rows("product_variants")[0].stock, 3);

  // The storefront-facing product list reflects the new stock.
  const products = await listProducts(env);
  assert.equal(products[0].colors[0].variants[0].stock, 3);
});

test("checkout creates a customer on the first order and updates them on repeat orders", async () => {
  const env = await makeEnv();
  await seedProduct(env);

  // First order: customer row is created.
  await createOrder(env, basePayload());
  let customers = env.DB._rows("customers");
  assert.equal(customers.length, 1);
  assert.equal(customers[0].phone, "+254700000000");
  assert.equal(customers[0].name, "Jane Doe");
  assert.equal(customers[0].email, "jane@example.com");
  assert.equal(customers[0].location, "Westlands");
  assert.equal(customers[0].total_orders, 1);
  assert.equal(customers[0].lifetime_spend, 198);

  // Repeat order with the same phone: same row, updated fields + counters.
  // Quantity 1 → total 174 (24 + 150 delivery), so stock 5 - 2 - 1 stays ≥ 0.
  await createOrder(env, {
    ...basePayload(),
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
    customer: {
      name: "Jane D. Smith",
      phone: "+254700000000",
      email: "jane.new@example.com",
      location: "Kilimani",
    },
  });
  customers = env.DB._rows("customers");
  assert.equal(customers.length, 1);
  assert.equal(customers[0].name, "Jane D. Smith");
  assert.equal(customers[0].email, "jane.new@example.com");
  assert.equal(customers[0].location, "Kilimani");
  assert.equal(customers[0].total_orders, 2);
  assert.equal(customers[0].lifetime_spend, 372); // 198 + 174

  // A different phone becomes a separate customer.
  await createOrder(env, {
    ...basePayload(),
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
    customer: {
      name: "Bob Mwangi",
      phone: "+254711111111",
      email: "bob@example.com",
      location: "Nairobi CBD",
    },
  });
  customers = env.DB._rows("customers");
  assert.equal(customers.length, 2);
  assert.equal(
    customers.find((c) => c.phone === "+254711111111").total_orders,
    1,
  );
});

test("customer upsert merges on phone conflict instead of duplicating (race path)", async () => {
  const env = await makeEnv();

  // Simulate two concurrent first orders for the same phone: both checkout
  // SELECTs miss each other, so both fire the upsert INSERT. The second must
  // merge into the first row (ON CONFLICT DO UPDATE) — never create a dupe.
  const upsert = (id, name, spend) =>
    env.DB.prepare(
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
    ).bind(id, "+254700000000", name, `${id}@example.com`, "Westlands", spend);

  await upsert("cus-1", "Jane", 198).run();
  await upsert("cus-2", "Jane Doe", 174).run();

  const rows = env.DB._rows("customers");
  assert.equal(rows.length, 1); // merged, not duplicated
  assert.equal(rows[0].id, "cus-1"); // first row won
  assert.equal(rows[0].name, "Jane Doe"); // latest fields won
  assert.equal(rows[0].email, "cus-2@example.com");
  assert.equal(rows[0].total_orders, 2);
  assert.equal(rows[0].lifetime_spend, 372); // 198 + 174
});

const seedSimpleProduct = async (env, stock) => {
  await createProduct(env, {
    id: "prod-tote",
    name: "Mambo Tote Bag",
    slug: "mambo-tote-bag",
    price: 12,
    category: "Accessories",
    productType: "simple",
    stock,
    gallery: [],
  });
};

test("checkout supports simple products: no color/size, NULL order line, stock deducted", async () => {
  const env = await makeEnv();
  await seedSimpleProduct(env, 53);

  const order = await createOrder(env, {
    customer: { name: "Jane Doe", phone: "+254700000000" },
    items: [{ productId: "prod-tote", quantity: 3 }],
    deliveryFee: 0,
  });

  assert.equal(order.subtotal, 36); // 12 * 3
  assert.equal(order.total, 36);
  assert.equal(order.items[0].colorId, null);
  assert.equal(order.items[0].size, "");

  // Order line stored with NULL color_id / size_id / size.
  const items = env.DB._rows("order_items");
  assert.equal(items.length, 1);
  assert.equal(items[0].product_id, "prod-tote");
  assert.equal(items[0].color_id, null);
  assert.equal(items[0].size_id, null);
  assert.equal(items[0].size, null);
  assert.equal(items[0].quantity, 3);

  // The single stock row was deducted; no variant mirror exists.
  assert.equal(env.DB._rows("product_variants").length, 0);
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].stock, 50);
  assert.equal(inventory[0].color_id, null);
  assert.equal(inventory[0].size_id, null);
});

test("checkout rejects simple product orders over the single stock figure", async () => {
  const env = await makeEnv();
  await seedSimpleProduct(env, 2);

  await assert.rejects(
    () =>
      createOrder(env, {
        customer: { name: "Jane Doe", phone: "+254700000000" },
        items: [{ productId: "prod-tote", quantity: 5 }],
      }),
    (error) => error.code === "INSUFFICIENT_STOCK" && error.status === 400,
  );

  assert.equal(env.DB._rows("orders").length, 0);
  assert.equal(env.DB._rows("inventory")[0].stock, 2);
});

test("insufficient stock rejects the order with a structured error and writes nothing", async () => {
  const env = await makeEnv();
  await seedProduct(env);

  await assert.rejects(
    () =>
      createOrder(env, {
        ...basePayload(),
        items: [
          { productId: "prod-1", colorId: "color-1", size: "M", quantity: 99 },
        ],
      }),
    (error) => error.code === "INSUFFICIENT_STOCK" && error.status === 400,
  );

  assert.equal(env.DB._rows("orders").length, 0);
  assert.equal(env.DB._rows("order_items").length, 0);
  assert.equal(env.DB._rows("inventory")[0].stock, 5);
  assert.equal(env.DB._rows("product_variants")[0].stock, 5);
});

test("unknown product returns PRODUCT_NOT_FOUND", async () => {
  const env = await makeEnv();
  await assert.rejects(
    () =>
      createOrder(env, {
        ...basePayload(),
        items: [
          { productId: "nope", colorId: "color-1", size: "M", quantity: 1 },
        ],
      }),
    (error) => error.code === "PRODUCT_NOT_FOUND" && error.status === 404,
  );
});

test("order numbers are sequential per day", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  const first = await generateOrderNumber(env, new Date("2026-08-05T12:00:00Z"));
  assert.equal(first, "MB-20260805-0001");

  // createOrder stamps the order with today's date, so the second number is
  // derived from the current day (the sequence restarts each day).
  await createOrder(env, basePayload());
  const now = new Date();
  const prefix = `MB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}${String(now.getDate()).padStart(2, "0")}`;
  const second = await generateOrderNumber(env, now);
  assert.equal(second, `${prefix}-0002`);
});

test("listOrders returns orders with embedded items", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  await createOrder(env, basePayload());

  const { orders } = await listOrders(env);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].customerName, "Jane Doe");
  assert.equal(orders[0].items.length, 1);
  assert.equal(orders[0].items[0].quantity, 2);
});

test("listOrders supports pagination, search, status, and date filters", async () => {
  const env = await makeEnv();
  await seedProduct(env);

  const first = await createOrder(env, basePayload());
  await createOrder(env, {
    ...basePayload(),
    customer: {
      name: "Alice Wanjiru",
      phone: "+254722000000",
      email: "alice@example.com",
      location: "Karen",
    },
  });
  await createOrder(env, {
    ...basePayload(),
    customer: {
      name: "Bob Mwangi",
      phone: "+254733000000",
      email: "bob@example.com",
      location: "CBD",
    },
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
  });
  await updateOrderStatus(env, first.orderId, { status: "shipped" });

  // Search matches customer name.
  const byName = await listOrders(env, { search: "Alice" });
  assert.equal(byName.total, 1);
  assert.equal(byName.orders[0].customerName, "Alice Wanjiru");

  // Search matches the order number.
  const byNumber = await listOrders(env, { search: first.orderNumber });
  assert.equal(byNumber.total, 1);
  assert.equal(byNumber.orders[0].id, first.orderId);

  // Status filter.
  const shipped = await listOrders(env, { status: "shipped" });
  assert.equal(shipped.total, 1);
  assert.equal(shipped.orders[0].id, first.orderId);

  // Pagination: 3 orders, page size 2.
  const pageOne = await listOrders(env, { page: 1, pageSize: 2 });
  assert.equal(pageOne.orders.length, 2);
  assert.equal(pageOne.total, 3);
  assert.equal(pageOne.totalPages, 2);
  const pageTwo = await listOrders(env, { page: 2, pageSize: 2 });
  assert.equal(pageTwo.orders.length, 1);

  // Items are enriched with product and color names.
  const detail = await listOrders(env, { page: 1, pageSize: 1 });
  assert.equal(detail.orders[0].items[0].productName, "Classic Beard Oil");
  assert.equal(detail.orders[0].items[0].colorName, "Amber");
  assert.equal(detail.orders[0].items[0].colorHex, "#b97a1b");
});

test("updateOrderStatus updates an existing order and 404s unknown ids", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  const order = await createOrder(env, basePayload());

  const updated = await updateOrderStatus(env, order.orderId, { status: "confirmed" });
  assert.equal(updated.status, "confirmed");
  assert.equal(env.DB._rows("orders")[0].status, "confirmed");

  await assert.rejects(
    () => updateOrderStatus(env, "ord-missing", { status: "confirmed" }),
    (error) => error.code === "ORDER_NOT_FOUND" && error.status === 404,
  );

  await assert.rejects(
    () => updateOrderStatus(env, order.orderId, { status: "nonsense" }),
    (error) => error.code === "INVALID_STATUS" && error.status === 400,
  );
});
