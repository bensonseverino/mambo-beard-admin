import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as sizeChartsHandler } from "../api/size-charts.js";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { createProduct, listProducts, updateProduct } from "./products-db.js";
import { SIZE_CHARTS } from "../../src/size-charts.js";

test("every size chart is internally consistent", () => {
  const ids = SIZE_CHARTS.map((chart) => chart.id);
  assert.equal(new Set(ids).size, ids.length, "chart ids must be unique");

  for (const chart of SIZE_CHARTS) {
    assert.ok(chart.id, `${chart.id || "?"}: missing id`);
    assert.ok(chart.title, `${chart.id}: missing title`);
    assert.equal(chart.unit, "inches");
    assert.ok(Array.isArray(chart.appliesTo) && chart.appliesTo.length);
    assert.ok(chart.sizes.length >= 2, `${chart.id}: needs sizes`);
    assert.ok(
      Object.keys(chart.measurements).length >= 2,
      `${chart.id}: needs measurements`,
    );
    for (const [label, values] of Object.entries(chart.measurements)) {
      assert.equal(
        values.length,
        chart.sizes.length,
        `${chart.id}: ${label} must have one value per size`,
      );
    }
  }
});

test("GET /api/size-charts serves the full library", async () => {
  const response = await sizeChartsHandler({
    request: new Request("https://example.com/api/size-charts"),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.length, SIZE_CHARTS.length);

  const hoodies = payload.data.find(
    (chart) => chart.id === "size-chart-hoodies",
  );
  assert.equal(hoodies.title, "Hoodies");
  assert.equal(hoodies.sizes.length, 7);
  assert.equal(hoodies.measurements.Chest[3], 44);
});

test("GET /api/size-charts rejects non-GET requests", async () => {
  const response = await sizeChartsHandler({
    request: new Request("https://example.com/api/size-charts", {
      method: "POST",
    }),
  });
  assert.equal(response.status, 405);
});

test("products persist and expose their size chart assignment", async () => {
  const env = { DB: createFakeD1() };

  await createProduct(env, {
    id: "prod-hoodie",
    name: "Distorted Hoodie",
    slug: "distorted-hoodie",
    price: 45,
    category: "Apparel",
    sizeChartId: "size-chart-hoodies",
    variationType: "size",
    sizes: [{ id: "size-m", name: "M", stock: 6 }],
  });
  await createProduct(env, {
    id: "prod-tote",
    name: "Mambo Tote Bag",
    slug: "mambo-tote-bag",
    price: 12,
    category: "Accessories",
    productType: "simple",
    stock: 5,
  });

  assert.equal(
    env.DB._rows("products").find((row) => row.id === "prod-hoodie")
      .size_chart_id,
    "size-chart-hoodies",
  );

  const listed = await listProducts(env);
  const byId = Object.fromEntries(listed.map((p) => [p.id, p]));
  assert.equal(byId["prod-hoodie"].sizeChartId, "size-chart-hoodies");
  // Products without an assignment stay null.
  assert.equal(byId["prod-tote"].sizeChartId, null);

  // Editing without sizeChartId clears the assignment (full-rebuild update).
  await createProduct(env, {
    id: "prod-tshirt",
    name: "Mambo T-Shirt",
    slug: "mambo-t-shirt",
    price: 25,
    category: "Apparel",
    sizeChartId: "size-chart-tshirts",
    variationType: "size",
    sizes: [{ id: "size-l", name: "L", stock: 2 }],
  });
  await updateProduct(env, "prod-tshirt", {
    id: "prod-tshirt",
    name: "Mambo T-Shirt v2",
    slug: "mambo-t-shirt",
    price: 25,
    category: "Apparel",
    variationType: "size",
    sizes: [{ id: "size-l", name: "L", stock: 2 }],
  });
  const updated = await listProducts(env);
  assert.equal(
    updated.find((p) => p.id === "prod-tshirt").sizeChartId,
    null,
  );
});
