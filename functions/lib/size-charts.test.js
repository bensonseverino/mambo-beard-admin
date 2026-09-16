import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as sizeChartsHandler } from "../api/size-charts.js";
import { onRequest as productDetailHandler } from "../api/products/[id].js";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { createProduct, listProducts, updateProduct } from "./products-db.js";
import {
  SIZE_CHARTS,
  buildProductSizeChart,
  getSizeChart,
  toProductSizeChart,
} from "../../src/size-charts.js";

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

test("charts resolve into the storefront columns/rows payload", () => {
  const chart = getSizeChart("size-chart-mens-sweatpants");
  const payload = toProductSizeChart(chart);

  assert.deepEqual(payload.columns, [
    "Waist (in)",
    "Hips (in)",
    "Thigh (in)",
    "Inseam (in)",
    "Outseam (in)",
  ]);
  assert.equal(payload.rows.length, chart.sizes.length);
  assert.deepEqual(payload.rows[0], {
    size: "XS",
    measurements: ["25-28", "34", "18", "30", "38"],
  });
  // Every value is a string so the stored JSON matches the storefront shape.
  assert.ok(
    payload.rows.every((row) =>
      row.measurements.every((value) => typeof value === "string"),
    ),
  );

  // Only actual garment measurements remain in the stored payload; the size
  // labels are still carried by the `size` column in each row.
  assert.deepEqual(
    toProductSizeChart(getSizeChart("size-chart-tshirts")).columns,
    [
      "Length (in)",
      "Chest (in)",
      "Across Shoulder (in)",
      "Short Sleeve Length (in)",
      "Long Sleeve Length (in)",
    ],
  );

  // No assignment, or an id that is not in the library, means no chart.
  assert.equal(buildProductSizeChart(""), null);
  assert.equal(buildProductSizeChart("size-chart-does-not-exist"), null);
});

// The storefront renders products.size_chart (columns/rows JSON) and knows
// nothing about the chart id, so both must be written together — and a
// database created before this feature must still gain the columns.
test("a pre-existing products table gains the size chart columns at runtime", async () => {
  const env = { DB: createFakeD1() };
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      price REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

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

  const columns = env.DB._columns("products");
  assert.ok(columns.includes("size_chart_id"), "size_chart_id must be added");
  assert.ok(columns.includes("size_chart"), "size_chart must be added");

  const [product] = await listProducts(env);
  assert.equal(product.sizeChartId, "size-chart-hoodies");
  assert.equal(product.sizeChart.rows.length, 7);
});

test("assignments made before size_chart existed render without a re-save", async () => {
  const env = { DB: createFakeD1() };
  // An older database: the id column exists, the payload column does not, and
  // this product was saved back when only the id was written.
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      price REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      size_chart_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await env.DB.prepare(
    "INSERT INTO products (id, name, slug, price, active, size_chart_id, created_at, updated_at)\n     VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
  )
    .bind(
      "prod-hoodie",
      "Distorted Hoodie",
      "distorted-hoodie",
      45,
      "size-chart-hoodies",
      "2026-01-01",
      "2026-01-01",
    )
    .run();

  const [product] = await listProducts(env);
  assert.equal(product.sizeChartId, "size-chart-hoodies");
  assert.equal(product.sizeChart.columns.length, 4);
  assert.equal(product.sizeChart.rows.length, 7);
  assert.equal(product.sizeChart.rows[0].size, "XS");
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

  const storedRows = Object.fromEntries(
    env.DB._rows("products").map((row) => [row.id, row]),
  );
  assert.equal(storedRows["prod-hoodie"].size_chart_id, "size-chart-hoodies");
  // The assignment is resolved into the columns/rows JSON the storefront
  // renders — storing only the id is what left the storefront blank.
  assert.deepEqual(JSON.parse(storedRows["prod-hoodie"].size_chart), {
    columns: ["Length (in)", "Chest (in)", "Across Shoulder (in)", "Sleeve (in)"],
    rows: [
      { size: "XS", measurements: ["26", "36", "16", "21.5"] },
      { size: "S", measurements: ["27", "38", "17", "22.5"] },
      { size: "M", measurements: ["28", "40", "18", "24"] },
      { size: "L", measurements: ["29", "44", "19", "26"] },
      { size: "XL", measurements: ["30", "46", "20", "27"] },
      { size: "2XL", measurements: ["31", "48", "21", "28"] },
      { size: "3XL", measurements: ["32", "50", "22", "28"] },
    ],
  });
  // No chart means NULL on both columns, never an empty payload.
  assert.equal(storedRows["prod-tote"].size_chart_id, null);
  assert.equal(storedRows["prod-tote"].size_chart, null);

  const listed = await listProducts(env);
  const byId = Object.fromEntries(listed.map((p) => [p.id, p]));
  assert.equal(byId["prod-hoodie"].sizeChartId, "size-chart-hoodies");
  assert.equal(byId["prod-hoodie"].sizeChart.rows.length, 7);
  // Products without an assignment stay null.
  assert.equal(byId["prod-tote"].sizeChartId, null);
  assert.equal(byId["prod-tote"].sizeChart, null);

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
  assert.equal(updated.find((p) => p.id === "prod-tshirt").sizeChartId, null);
  assert.equal(updated.find((p) => p.id === "prod-tshirt").sizeChart, null);
  assert.equal(
    env.DB._rows("products").find((row) => row.id === "prod-tshirt")
      .size_chart,
    null,
  );
});

test("a chart-only update rewrites the chart columns without rebuilding the product", async () => {
  const env = { DB: createFakeD1() };
  await createProduct(env, {
    id: "prod-hoodie",
    name: "Distorted Hoodie",
    slug: "distorted-hoodie",
    price: 45,
    category: "Apparel",
    sizeChartId: "size-chart-mens-sweatpants",
    variationType: "color_size",
    colors: [
      {
        id: "color-1",
        name: "Ink",
        hex: "#111827",
        images: [{ id: "image-1", path: "prod/hoodie.jpg" }],
        variants: [{ size: "M", stock: 4 }],
      },
    ],
  });

  // Pin created_at: a rebuild stamps it to now, while the chart fast path
  // never writes it at all — so it is the signal that the row was untouched.
  await env.DB.prepare("UPDATE products SET created_at = ? WHERE id = ?")
    .bind("2026-01-01T00:00:00.000Z", "prod-hoodie")
    .run();

  const colorsBefore = JSON.parse(JSON.stringify(env.DB._rows("product_colors")));
  const imagesBefore = JSON.parse(JSON.stringify(env.DB._rows("product_images")));
  const inventoryBefore = JSON.parse(JSON.stringify(env.DB._rows("inventory")));

  const updated = await updateProduct(env, "prod-hoodie", {
    sizeChartId: "size-chart-hoodies",
  });
  assert.equal(updated.sizeChartId, "size-chart-hoodies");
  assert.deepEqual(updated.sizeChart, buildProductSizeChart("size-chart-hoodies"));
  // Returned so the caller can purge the storefront's slug-keyed cache entry.
  assert.equal(updated.slug, "distorted-hoodie");

  const row = env.DB._rows("products").find((entry) => entry.id === "prod-hoodie");
  assert.equal(row.size_chart_id, "size-chart-hoodies");
  assert.deepEqual(JSON.parse(row.size_chart), updated.sizeChart);
  assert.equal(row.created_at, "2026-01-01T00:00:00.000Z");
  assert.equal(row.name, "Distorted Hoodie");
  assert.equal(row.slug, "distorted-hoodie");
  assert.equal(row.price, 45);
  // The child rows were not deleted and re-inserted.
  assert.deepEqual(env.DB._rows("product_colors"), colorsBefore);
  assert.deepEqual(env.DB._rows("product_images"), imagesBefore);
  assert.deepEqual(env.DB._rows("inventory"), inventoryBefore);

  // Clearing the assignment nulls both columns, and still does not rebuild.
  const clearedResult = await updateProduct(env, "prod-hoodie", {
    sizeChartId: null,
  });
  assert.equal(clearedResult.sizeChartId, null);
  assert.equal(clearedResult.sizeChart, null);
  const cleared = env.DB._rows("products").find((entry) => entry.id === "prod-hoodie");
  assert.equal(cleared.size_chart_id, null);
  assert.equal(cleared.size_chart, null);
  assert.equal(cleared.created_at, "2026-01-01T00:00:00.000Z");

  const [listed] = await listProducts(env);
  assert.equal(listed.sizeChartId, null);
  assert.equal(listed.sizeChart, null);
});

test("PUT /api/products/:id accepts a body carrying only a chart", async () => {
  const env = { DB: createFakeD1() };
  await createProduct(env, {
    id: "prod-tee",
    name: "Mambo T-Shirt",
    slug: "mambo-t-shirt",
    price: 25,
    category: "Apparel",
    variationType: "size",
    sizes: [{ id: "size-l", name: "L", stock: 2 }],
  });
  const before = { ...env.DB._rows("products").find((r) => r.id === "prod-tee") };
  assert.equal(before.size_chart_id, null);

  const response = await productDetailHandler({
    request: new Request("https://example.com/api/products/prod-tee", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sizeChartId: "size-chart-tshirts" }),
    }),
    params: { id: "prod-tee" },
    env,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.id, "prod-tee");
  assert.equal(payload.data.sizeChartId, "size-chart-tshirts");
  assert.deepEqual(payload.data.sizeChart, buildProductSizeChart("size-chart-tshirts"));
  // The row is updated in place, keeping its identity and its slug.
  const after = env.DB._rows("products").find((r) => r.id === "prod-tee");
  assert.equal(after.slug, before.slug);
  assert.equal(after.created_at, before.created_at);
  assert.equal(after.size_chart_id, "size-chart-tshirts");
});

test("only a sole-sizeChartId payload takes the fast path", async () => {
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
  await env.DB.prepare("UPDATE products SET created_at = ? WHERE id = ?")
    .bind("2026-01-01T00:00:00.000Z", "prod-hoodie")
    .run();

  // Any other key makes it an ordinary product edit: it must still be
  // normalized and rebuilt, never silently reduced to a chart assignment.
  await updateProduct(env, "prod-hoodie", {
    id: "prod-hoodie",
    name: "Distorted Hoodie v2",
    slug: "distorted-hoodie",
    price: 45,
    category: "Apparel",
    variationType: "size",
    sizeChartId: "size-chart-hoodies",
    sizes: [{ id: "size-m", name: "M", stock: 6 }],
  });
  const rebuilt = env.DB._rows("products").find((entry) => entry.id === "prod-hoodie");
  assert.equal(rebuilt.name, "Distorted Hoodie v2");
  assert.notEqual(rebuilt.created_at, "2026-01-01T00:00:00.000Z");
  assert.equal(rebuilt.size_chart_id, "size-chart-hoodies");

  // An unknown chart id degrades exactly like a full save: id kept, no payload.
  await updateProduct(env, "prod-hoodie", { sizeChartId: "size-chart-nope" });
  const unknown = env.DB._rows("products").find((entry) => entry.id === "prod-hoodie");
  assert.equal(unknown.size_chart_id, "size-chart-nope");
  assert.equal(unknown.size_chart, null);

  await assert.rejects(
    () => updateProduct(env, "prod-missing", { sizeChartId: "size-chart-hoodies" }),
    (error) => error.code === "PRODUCT_NOT_FOUND" && error.status === 404,
  );
});
