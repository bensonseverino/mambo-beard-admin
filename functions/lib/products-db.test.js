import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as productsHandler } from "../api/products.js";

test("products API returns created products from the database layer", async () => {
  const inserted = [];
  const fakeDb = {
    prepare() {
      return {
        bind(...values) {
          return { values, execute: async () => ({ success: true }) };
        },
      };
    },
    batch(statements) {
      inserted.push(...statements.map((statement) => statement.values));
      return Promise.resolve();
    },
  };

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
          name: "Amber",
          hex: "#b97a1b",
          images: [],
          variants: [{ size: "M", stock: 4 }],
        },
      ],
    }),
  });

  const response = await productsHandler({ request, env: { DB: fakeDb } });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.name, "Test Beard Oil");
  assert.equal(payload.data.colors[0].name, "Amber");
  assert.ok(inserted.length > 0);
});
