import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as dashboardHandler } from "../api/dashboard.js";
import { onRequest as productsHandler } from "../api/products.js";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { createOrder } from "./orders-db.js";
import {
  createProduct,
  deleteProduct,
  getProductDetail,
  listProducts,
  updateProduct,
} from "./products-db.js";

const makeEnv = () => ({ DB: createFakeD1() });

test("products API creates a product with colors, variants, inventory, and seeded sizes", async () => {
  const env = makeEnv();

  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Test Beard Oil",
      slug: "test-beard-oil",
      description: "A test product",
      price: 24,
      category: "Care",
      featured: true,
      active: true,
      colors: [
        {
          id: "color-1",
          name: "Amber",
          hex: "#b97a1b",
          images: [
            { id: "img-1", path: "products/test-beard-oil/amber/front.webp" },
          ],
          variants: [{ size: "M", stock: 4 }],
        },
      ],
    }),
  });

  const response = await productsHandler({ request, env });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.name, "Test Beard Oil");
  assert.equal(payload.data.colors[0].name, "Amber");

  // Schema was bootstrapped automatically (the D1_ERROR fix).
  assert.equal(env.DB._rows("products").length, 1);
  assert.equal(env.DB._rows("product_colors").length, 1);
  assert.equal(env.DB._rows("product_variants").length, 1);
  assert.equal(env.DB._rows("inventory").length, 1);
  assert.equal(env.DB._rows("order_items").length, 0);
  assert.deepEqual(env.DB._rows("orders"), []);
  assert.equal(env.DB._rows("product_images").length, 1);

  // Sizes were seeded and the variant got an inventory mirror row.
  const sizeNames = env.DB._rows("sizes").map((size) => size.name);
  assert.deepEqual(sizeNames.sort(), ["L", "M", "S", "XL", "XS"]);
  const inventory = env.DB._rows("inventory")[0];
  assert.equal(inventory.product_id, payload.data.id);
  assert.equal(inventory.color_id, "color-1");
  assert.equal(inventory.stock, 4);
});

const createTestProduct = async (env) => {
  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
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
          variants: [{ size: "M", stock: 5 }],
        },
      ],
    }),
  });
  return productsHandler({ request, env });
};

test("deleteProduct soft-deletes: keeps the row, hides it from the catalog, and preserves order history", async () => {
  const env = makeEnv();
  await createTestProduct(env);

  // Place an order so we can prove its line items survive deletion.
  await createOrder(env, {
    customer: { name: "Jane Doe", phone: "+254700000000" },
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
  });
  assert.equal(env.DB._rows("order_items").length, 1);

  const deleted = await deleteProduct(env, "prod-1");
  assert.equal(deleted, true);

  // The product row still exists but is inactive; its colors and inventory
  // are kept so restore is trivial and order history still resolves names.
  const rows = env.DB._rows("products");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].active, 0);
  assert.equal(env.DB._rows("product_colors").length, 1);
  assert.equal(env.DB._rows("inventory").length, 1);
  assert.equal(env.DB._rows("order_items").length, 1);

  // The storefront catalog and detail endpoint hide soft-deleted products.
  const visible = await listProducts(env);
  assert.equal(visible.length, 0);
  assert.equal(await getProductDetail(env, "prod-1"), null);

  // The admin can still see them via includeInactive.
  const withDeleted = await listProducts(env, { includeInactive: true });
  assert.equal(withDeleted.length, 1);
  assert.equal(withDeleted[0].active, false);

  await assert.rejects(
    () => deleteProduct(env, "prod-missing"),
    (error) => error.code === "PRODUCT_NOT_FOUND" && error.status === 404,
  );
});

test("updateProduct restores a soft-deleted product via the active flag", async () => {
  const env = makeEnv();
  await createTestProduct(env);
  await deleteProduct(env, "prod-1");

  const restored = await updateProduct(env, "prod-1", { active: true });
  assert.equal(restored.active, true);
  assert.equal(env.DB._rows("products")[0].active, 1);
  assert.equal((await listProducts(env)).length, 1);
});

test("editing a product does not erase order history", async () => {
  const env = makeEnv();
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
        variants: [{ size: "M", stock: 5 }],
      },
    ],
  });
  await createOrder(env, {
    customer: { name: "Jane Doe", phone: "+254700000000" },
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
  });
  assert.equal(env.DB._rows("order_items").length, 1);

  // A full edit rebuilds the product row internally; the order line items
  // must survive (the 0002 migration removes the destructive cascade).
  await updateProduct(env, "prod-1", {
    id: "prod-1",
    name: "Classic Beard Oil v2",
    slug: "classic-beard-oil",
    price: 26,
    category: "Care",
    colors: [
      {
        id: "color-1",
        name: "Amber",
        hex: "#b97a1b",
        images: [],
        variants: [{ size: "M", stock: 7 }],
      },
    ],
  });
  assert.equal(env.DB._rows("order_items").length, 1);
});

test("dashboard low-stock excludes soft-deleted products", async () => {
  const env = makeEnv();
  await createProduct(env, {
    id: "prod-1",
    name: "Active Oil",
    slug: "active-oil",
    price: 24,
    category: "Care",
    colors: [
      {
        id: "color-1",
        name: "Amber",
        hex: "#b97a1b",
        images: [],
        variants: [{ size: "M", stock: 1 }],
      },
    ],
  });
  await createProduct(env, {
    id: "prod-2",
    name: "Deleted Balm",
    slug: "deleted-balm",
    price: 18,
    category: "Care",
    colors: [
      {
        id: "color-2",
        name: "Default",
        hex: "#111827",
        images: [],
        variants: [{ size: "M", stock: 0 }],
      },
    ],
  });
  await deleteProduct(env, "prod-2");

  const response = await dashboardHandler({
    request: new Request("https://example.com/api/dashboard"),
    env,
  });
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.lowStockProducts.length, 1);
  assert.equal(payload.data.lowStockProducts[0].productId, "prod-1");
  assert.equal(payload.data.lowStockCount, 1);
});

test("products API lists created products with colors", async () => {
  const env = makeEnv();
  const createRequest = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Beard Comb",
      slug: "beard-comb",
      price: 12,
      category: "Tools",
      colors: [
        {
          id: "color-1",
          name: "Default",
          hex: "#111827",
          images: [],
          variants: [{ size: "S", stock: 3 }],
        },
      ],
    }),
  });
  await productsHandler({ request: createRequest, env });

  const listRequest = new Request("https://example.com/api/products");
  const response = await productsHandler({ request: listRequest, env });
  const payload = await response.json();

  assert.equal(payload.success, true);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].name, "Beard Comb");
  assert.equal(payload.data[0].colors[0].variants[0].size, "S");
  assert.equal(payload.data[0].colors[0].variants[0].stock, 3);
});
