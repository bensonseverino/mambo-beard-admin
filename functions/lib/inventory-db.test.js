import test from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { createProduct } from "./products-db.js";
import { listInventory, updateInventoryStock } from "./inventory-db.js";
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
        variants: [
          { size: "S", stock: 3 },
          { size: "M", stock: 5 },
        ],
      },
    ],
  });
};

test("listInventory groups stock by product, color, and size", async () => {
  const env = await makeEnv();
  await seedProduct(env);

  const inventory = await listInventory(env);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].productName, "Classic Beard Oil");
  assert.equal(inventory[0].category, "Care");
  assert.equal(inventory[0].colors.length, 1);
  assert.equal(inventory[0].colors[0].colorName, "Amber");
  assert.equal(inventory[0].colors[0].hex, "#b97a1b");
  const sizes = inventory[0].colors[0].rows.map((row) => row.size).sort();
  assert.deepEqual(sizes, ["M", "S"]);
  const mRow = inventory[0].colors[0].rows.find((row) => row.size === "M");
  assert.equal(mRow.stock, 5);
});

const seedSimpleProduct = async (env) => {
  await createProduct(env, {
    id: "prod-tote",
    name: "Mambo Tote Bag",
    slug: "mambo-tote-bag",
    price: 12,
    category: "Accessories",
    productType: "simple",
    stock: 53,
    gallery: [],
  });
};

test("listInventory groups simple product stock without color or size", async () => {
  const env = await makeEnv();
  await seedSimpleProduct(env);

  const inventory = await listInventory(env);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].productName, "Mambo Tote Bag");
  assert.equal(inventory[0].productType, "simple");
  assert.equal(inventory[0].colors.length, 1);
  const color = inventory[0].colors[0];
  assert.equal(color.colorId, null);
  assert.equal(color.rows.length, 1);
  assert.equal(color.rows[0].size, null);
  assert.equal(color.rows[0].stock, 53);
});

test("updateInventoryStock updates a simple product stock row without touching variants", async () => {
  const env = await makeEnv();
  await seedSimpleProduct(env);

  const inventory = await listInventory(env);
  const rowId = inventory[0].colors[0].rows[0].id;

  const updated = await updateInventoryStock(env, rowId, 9);
  assert.equal(updated.stock, 9);
  assert.equal(env.DB._rows("inventory")[0].stock, 9);
  // No product_variants mirror exists for simple products.
  assert.equal(env.DB._rows("product_variants").length, 0);
});

test("updateInventoryStock updates the inventory row and its variant mirror", async () => {
  const env = await makeEnv();
  await seedProduct(env);

  const inventory = await listInventory(env);
  const rowId = inventory[0].colors[0].rows.find(
    (row) => row.size === "S",
  ).id;

  const updated = await updateInventoryStock(env, rowId, 9);
  assert.equal(updated.stock, 9);
  assert.equal(env.DB._rows("inventory").find((r) => r.id === rowId).stock, 9);
  const variant = env.DB._rows("product_variants").find((v) => v.size === "S");
  assert.equal(variant.stock, 9);

  await assert.rejects(
    () => updateInventoryStock(env, "inv-missing", 5),
    (error) => error.code === "INVENTORY_NOT_FOUND" && error.status === 404,
  );

  await assert.rejects(
    () => updateInventoryStock(env, rowId, "abc"),
    (error) => error.code === "INVALID_STOCK" && error.status === 400,
  );

  await assert.rejects(
    () => updateInventoryStock(env, rowId, -3),
    (error) => error.code === "INVALID_STOCK" && error.status === 400,
  );
});

test("listInventory groups color-only products with one stock row per color", async () => {
  const env = await makeEnv();
  await createProduct(env, {
    id: "prod-cap",
    name: "Mambo Cap",
    slug: "mambo-cap",
    price: 15,
    category: "Accessories",
    variationType: "color",
    colors: [
      { id: "color-black", name: "Black", hex: "#000000", images: [], variants: [{ size: null, stock: 10 }] },
      { id: "color-cream", name: "Cream", hex: "#F2E8D5", images: [], variants: [{ size: null, stock: 2 }] },
    ],
  });

  const inventory = await listInventory(env);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].variationType, "color");
  assert.equal(inventory[0].colors.length, 2);
  const black = inventory[0].colors.find((color) => color.colorName === "Black");
  assert.equal(black.rows.length, 1);
  assert.equal(black.rows[0].size, null);
  assert.equal(black.rows[0].stock, 10);
});

test("listInventory groups size-only products under one Sizes group", async () => {
  const env = await makeEnv();
  await createProduct(env, {
    id: "prod-tshirt",
    name: "Mambo T-Shirt",
    slug: "mambo-t-shirt",
    price: 25,
    category: "Apparel",
    variationType: "size",
    sizes: [
      { id: "size-s", name: "S", stock: 4 },
      { id: "size-xxl", name: "XXL", stock: 3 },
    ],
  });

  const inventory = await listInventory(env);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].variationType, "size");
  assert.equal(inventory[0].colors.length, 1);
  const group = inventory[0].colors[0];
  assert.equal(group.colorName, "Sizes");
  assert.equal(group.colorId, null);
  const sizes = group.rows.map((row) => row.size).sort();
  assert.deepEqual(sizes, ["S", "XXL"]);
  const xxl = group.rows.find((row) => row.size === "XXL");
  assert.equal(xxl.stock, 3);
});

test("updateInventoryStock updates a size-only stock row without a variant mirror", async () => {
  const env = await makeEnv();
  await createProduct(env, {
    id: "prod-tshirt",
    name: "Mambo T-Shirt",
    slug: "mambo-t-shirt",
    price: 25,
    category: "Apparel",
    variationType: "size",
    sizes: [{ id: "size-xxl", name: "XXL", stock: 3 }],
  });

  const inventory = await listInventory(env);
  const rowId = inventory[0].colors[0].rows[0].id;
  const updated = await updateInventoryStock(env, rowId, 8);
  assert.equal(updated.stock, 8);
  assert.equal(env.DB._rows("inventory")[0].stock, 8);
  // Size-only products have no product_variants rows to mirror into.
  assert.equal(env.DB._rows("product_variants").length, 0);
});
