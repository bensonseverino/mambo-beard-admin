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

  await createOrder(env, basePayload());
  const second = await generateOrderNumber(env, new Date("2026-08-05T13:00:00Z"));
  assert.equal(second, "MB-20260805-0002");
});

test("listOrders returns orders with embedded items", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  await createOrder(env, basePayload());

  const orders = await listOrders(env);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].customerName, "Jane Doe");
  assert.equal(orders[0].items.length, 1);
  assert.equal(orders[0].items[0].quantity, 2);
});

test("updateOrderStatus updates an existing order and 404s unknown ids", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  const order = await createOrder(env, basePayload());

  const updated = await updateOrderStatus(env, order.orderId, { status: "processing" });
  assert.equal(updated.status, "processing");
  assert.equal(env.DB._rows("orders")[0].status, "processing");

  await assert.rejects(
    () => updateOrderStatus(env, "ord-missing", { status: "done" }),
    (error) => error.code === "ORDER_NOT_FOUND" && error.status === 404,
  );
});
