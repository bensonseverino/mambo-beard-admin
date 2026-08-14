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

  // Sizes were seeded (incl. XXL) and the variant got an inventory mirror row.
  const sizeNames = env.DB._rows("sizes").map((size) => size.name);
  assert.deepEqual(sizeNames.sort(), ["L", "M", "S", "XL", "XS", "XXL"]);
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

test("simple products are created with a gallery and a single NULL/NULL inventory row", async () => {
  const env = makeEnv();

  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Mambo Tote Bag",
      slug: "mambo-tote-bag",
      description: "Canvas tote",
      price: 12,
      category: "Accessories",
      productType: "simple",
      stock: 53,
      gallery: [
        {
          id: "g-1",
          path: "products/mambo-tote-bag/gallery/front.webp",
          isPrimary: true,
        },
        { id: "g-2", path: "products/mambo-tote-bag/gallery/back.webp" },
      ],
    }),
  });

  const response = await productsHandler({ request, env });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.productType, "simple");
  assert.equal(payload.data.stock, 53);
  assert.equal(payload.data.gallery.length, 2);
  assert.deepEqual(payload.data.colors, []);

  // No colors, variants, or size rows are created; images and stock are
  // stored with NULL color_id / size_id.
  assert.equal(env.DB._rows("product_colors").length, 0);
  assert.equal(env.DB._rows("product_variants").length, 0);
  const images = env.DB._rows("product_images");
  assert.equal(images.length, 2);
  assert.equal(images[0].color_id, null);
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].color_id, null);
  assert.equal(inventory[0].size_id, null);
  assert.equal(inventory[0].stock, 53);
});

test("listProducts and getProductDetail expose product_type, gallery, and stock", async () => {
  const env = makeEnv();
  await createProduct(env, {
    id: "prod-tote",
    name: "Mambo Tote Bag",
    slug: "mambo-tote-bag",
    price: 12,
    category: "Accessories",
    productType: "simple",
    stock: 7,
    gallery: [
      {
        id: "g-1",
        path: "products/mambo-tote-bag/gallery/front.webp",
        isPrimary: true,
      },
    ],
  });

  const listed = await listProducts(env);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].productType, "simple");
  assert.equal(listed[0].stock, 7);
  assert.equal(listed[0].gallery.length, 1);
  assert.deepEqual(listed[0].colors, []);

  const detail = await getProductDetail(env, "prod-tote");
  assert.equal(detail.product.productType, "simple");
  assert.equal(detail.stock, 7);
  assert.equal(detail.gallery.length, 1);
  assert.equal(detail.inventory.length, 1);
  assert.equal(detail.inventory[0].colorId, null);
  assert.deepEqual(detail.colors, []);
});

test("updateProduct switches variant → simple without corrupting records", async () => {
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

  // A past order must survive the type switch (0002/0003 keep FKs safe).
  await createOrder(env, {
    customer: { name: "Jane Doe", phone: "+254700000000" },
    items: [{ productId: "prod-1", colorId: "color-1", size: "M", quantity: 1 }],
  });
  assert.equal(env.DB._rows("order_items").length, 1);

  await updateProduct(env, "prod-1", {
    id: "prod-1",
    name: "Classic Beard Oil",
    slug: "classic-beard-oil",
    price: 24,
    category: "Care",
    productType: "simple",
    stock: 10,
    gallery: [
      {
        id: "g-1",
        path: "products/classic-beard-oil/gallery/front.webp",
        isPrimary: true,
      },
    ],
  });

  // Variant structures are gone; the simple structures exist.
  assert.equal(env.DB._rows("product_colors").length, 0);
  assert.equal(env.DB._rows("product_variants").length, 0);
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].color_id, null);
  assert.equal(inventory[0].size_id, null);
  assert.equal(inventory[0].stock, 10);

  // Order history survived the rebuild.
  assert.equal(env.DB._rows("order_items").length, 1);
  const listed = await listProducts(env);
  assert.equal(listed[0].productType, "simple");
  assert.equal(listed[0].stock, 10);
});

test("updateProduct switches simple → variant and rebuilds colors and inventory", async () => {
  const env = makeEnv();
  await createProduct(env, {
    id: "prod-1",
    name: "Classic Beard Oil",
    slug: "classic-beard-oil",
    price: 24,
    category: "Care",
    productType: "simple",
    stock: 10,
    gallery: [],
  });
  assert.equal(env.DB._rows("inventory").length, 1);

  await updateProduct(env, "prod-1", {
    id: "prod-1",
    name: "Classic Beard Oil",
    slug: "classic-beard-oil",
    price: 24,
    category: "Care",
    productType: "variant",
    colors: [
      {
        id: "color-1",
        name: "Amber",
        hex: "#b97a1b",
        images: [],
        variants: [{ size: "M", stock: 8 }],
      },
    ],
  });

  assert.equal(env.DB._rows("product_colors").length, 1);
  assert.equal(env.DB._rows("product_variants").length, 1);
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].color_id, "color-1");
  assert.equal(inventory[0].size_id, "size-m");
  assert.equal(inventory[0].stock, 8);
  const listed = await listProducts(env);
  assert.equal(listed[0].productType, "variant");
  assert.equal(listed[0].colors.length, 1);
  assert.equal(listed[0].colors[0].variants[0].stock, 8);
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

test("color-only products store one stock per color and never create sizes", async () => {
  const env = makeEnv();

  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Mambo Cap",
      slug: "mambo-cap",
      price: 15,
      category: "Accessories",
      variationType: "color",
      colors: [
        {
          id: "color-black",
          name: "Black",
          hex: "#000000",
          images: [],
          variants: [{ size: null, stock: 10 }],
        },
        {
          id: "color-cream",
          name: "Cream",
          hex: "#F2E8D5",
          images: [],
          variants: [{ size: null, stock: 7 }],
        },
      ],
    }),
  });

  const response = await productsHandler({ request, env });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.variationType, "color");
  assert.deepEqual(payload.data.sizes, []);
  assert.equal(payload.data.colors.length, 2);
  assert.equal(payload.data.colors[0].variants[0].size, null);
  assert.equal(payload.data.colors[0].variants[0].stock, 10);

  // Inventory rows: one per color with a NULL size; no variant mirror.
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 2);
  assert.equal(inventory[0].color_id, "color-black");
  assert.equal(inventory[0].size_id, null);
  assert.equal(inventory[0].stock, 10);
  assert.equal(env.DB._rows("product_variants").length, 0);
});

test("size-only products store one stock per size including XXL", async () => {
  const env = makeEnv();

  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Mambo T-Shirt",
      slug: "mambo-t-shirt",
      price: 25,
      category: "Apparel",
      variationType: "size",
      sizes: [
        { id: "size-s", name: "S", stock: 4 },
        { id: "size-m", name: "M", stock: 10 },
        { id: "size-xxl", name: "XXL", stock: 3 },
      ],
    }),
  });

  const response = await productsHandler({ request, env });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.variationType, "size");
  assert.deepEqual(payload.data.colors, []);
  const sizeNames = payload.data.sizes.map((size) => size.name);
  assert.deepEqual(sizeNames, ["S", "M", "XXL"]);
  assert.equal(
    payload.data.sizes.find((size) => size.name === "XXL").stock,
    3,
  );

  // Inventory rows: one per size with a NULL color.
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 3);
  assert.ok(
    inventory.every(
      (row) => row.color_id === null && row.size_id !== null,
    ),
  );
  const xxlRow = inventory.find((row) => row.size_id === "size-xxl");
  assert.equal(xxlRow.stock, 3);
  assert.equal(env.DB._rows("product_variants").length, 0);
});

test("color_size products store inventory per color + size including XXL", async () => {
  const env = makeEnv();

  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Distorted Hoodie",
      slug: "distorted-hoodie",
      price: 45,
      category: "Apparel",
      variationType: "color_size",
      colors: [
        {
          id: "color-black",
          name: "Black",
          hex: "#000000",
          images: [],
          variants: [
            { size: "S", stock: 2 },
            { size: "XXL", stock: 1 },
          ],
        },
      ],
    }),
  });

  const response = await productsHandler({ request, env });
  const payload = await response.json();

  assert.equal(payload.data.variationType, "color_size");
  const sizeNames = payload.data.sizes.map((size) => size.name);
  assert.deepEqual(sizeNames, ["S", "XXL"]);
  assert.equal(payload.data.colors[0].variants.length, 2);

  // Both an inventory mirror row and a product_variants row per combo.
  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 2);
  assert.ok(
    inventory.every(
      (row) => row.color_id === "color-black" && row.size_id !== null,
    ),
  );
  assert.equal(env.DB._rows("product_variants").length, 2);
  const xxlVariant = env.DB
    ._rows("product_variants")
    .find((variant) => variant.size === "XXL");
  assert.equal(xxlVariant.stock, 1);
});

test("variationType none is equivalent to a simple product", async () => {
  const env = makeEnv();

  const request = new Request("https://example.com/api/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Mambo Tote Bag",
      slug: "mambo-tote-bag",
      price: 25,
      category: "Accessories",
      variationType: "none",
      stock: 25,
      gallery: [
        { id: "g-1", path: "products/mambo-tote-bag/gallery/front.webp" },
      ],
    }),
  });

  const response = await productsHandler({ request, env });
  const payload = await response.json();

  assert.equal(payload.data.variationType, "none");
  assert.equal(payload.data.stock, 25);
  assert.deepEqual(payload.data.colors, []);
  assert.deepEqual(payload.data.sizes, []);
  assert.equal(payload.data.gallery.length, 1);

  const inventory = env.DB._rows("inventory");
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].color_id, null);
  assert.equal(inventory[0].size_id, null);
  assert.equal(inventory[0].stock, 25);
});

test("listProducts returns variationType, sizes, and stock per mode", async () => {
  const env = makeEnv();
  await createProduct(env, {
    id: "prod-color",
    name: "Cap",
    slug: "cap",
    price: 15,
    variationType: "color",
    colors: [
      { id: "c-1", name: "Black", hex: "#000000", images: [], variants: [{ size: null, stock: 4 }] },
    ],
  });
  await createProduct(env, {
    id: "prod-size",
    name: "T-Shirt",
    slug: "t-shirt",
    price: 25,
    variationType: "size",
    sizes: [{ id: "size-m", name: "M", stock: 6 }],
  });
  await createProduct(env, {
    id: "prod-none",
    name: "Tote",
    slug: "tote",
    price: 25,
    variationType: "none",
    stock: 9,
    gallery: [],
  });

  const listed = await listProducts(env);
  const byId = Object.fromEntries(listed.map((product) => [product.id, product]));

  assert.equal(byId["prod-color"].variationType, "color");
  assert.equal(byId["prod-color"].colors[0].variants[0].stock, 4);
  assert.equal(byId["prod-color"].stock, null);

  assert.equal(byId["prod-size"].variationType, "size");
  assert.equal(byId["prod-size"].sizes[0].name, "M");
  assert.equal(byId["prod-size"].sizes[0].stock, 6);

  assert.equal(byId["prod-none"].variationType, "none");
  assert.equal(byId["prod-none"].stock, 9);
});

test("getProductDetail exposes variationType and applicable sizes", async () => {
  const env = makeEnv();
  await createProduct(env, {
    id: "prod-size",
    name: "T-Shirt",
    slug: "t-shirt",
    price: 25,
    variationType: "size",
    sizes: [{ id: "size-xxl", name: "XXL", stock: 5 }],
  });

  const detail = await getProductDetail(env, "prod-size");
  assert.equal(detail.product.variationType, "size");
  assert.equal(detail.sizes.length, 1);
  assert.equal(detail.sizes[0].name, "XXL");
  assert.equal(detail.sizes[0].stock, 5);
  assert.deepEqual(detail.colors, []);
});
