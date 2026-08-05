import test from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { createProduct } from "./products-db.js";
import { createOrder } from "./orders-db.js";
import { getCustomerDetail, listCustomers } from "./customers-db.js";
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
    price: 24,
    category: "Care",
    colors: [
      {
        id: "color-1",
        name: "Amber",
        hex: "#b97a1b",
        images: [],
        variants: [{ size: "M", stock: 20 }],
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

test("listCustomers supports pagination and search", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  await createOrder(env, basePayload());
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

  const all = await listCustomers(env);
  assert.equal(all.total, 3);
  assert.equal(all.customers.length, 3);

  const byPhone = await listCustomers(env, { search: "254722" });
  assert.equal(byPhone.total, 1);
  assert.equal(byPhone.customers[0].name, "Alice Wanjiru");

  const byEmail = await listCustomers(env, { search: "bob@example" });
  assert.equal(byEmail.total, 1);
  assert.equal(byEmail.customers[0].phone, "+254733000000");

  const page = await listCustomers(env, { page: 1, pageSize: 2 });
  assert.equal(page.customers.length, 2);
  assert.equal(page.totalPages, 2);
});

test("getCustomerDetail returns order history, spend, AOV, and recent purchases", async () => {
  const env = await makeEnv();
  await seedProduct(env);
  await createOrder(env, basePayload()); // 198 = 48 + 150
  await createOrder(env, {
    ...basePayload(),
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
  }); // 174 = 24 + 150

  const { customers } = await listCustomers(env);
  const detail = await getCustomerDetail(env, customers[0].id);

  assert.equal(detail.customer.name, "Jane Doe");
  assert.equal(detail.customer.lifetimeSpend, 372);
  assert.equal(detail.orders.length, 2);
  assert.equal(detail.stats.totalSpend, 372);
  assert.equal(detail.stats.orderCount, 2);
  assert.equal(detail.stats.averageOrderValue, 186);
  assert.equal(detail.recentPurchases.length, 1);
  assert.equal(detail.recentPurchases[0].productName, "Classic Beard Oil");
  assert.equal(detail.recentPurchases[0].colorName, "Amber");
  assert.equal(detail.orders[0].items[0].productName, "Classic Beard Oil");

  await assert.rejects(
    () => getCustomerDetail(env, "cus-missing"),
    (error) => error.code === "CUSTOMER_NOT_FOUND" && error.status === 404,
  );
});
