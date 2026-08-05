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
