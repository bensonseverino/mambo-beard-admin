import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as productsHandler } from "../api/products.js";
import { createFakeD1 } from "./__tests__/fake-d1.js";

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
