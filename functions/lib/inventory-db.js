// Inventory operations for the admin dashboard.
//
// The inventory table mirrors per color/size stock alongside product_variants
// (kept in sync by checkout and product writes). Listing groups rows by
// product → color → size; updates write to both mirrors atomically.

import { apiError, ensureSchema, requireDb } from "./schema.js";

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

/**
 * List stock grouped by product → color → size.
 * Returns [{ productId, productName, category, colors: [{ colorId, colorName,
 * hex, rows: [{ id, sizeId, size, stock }] }] }].
 */
export const listInventory = async (env) => {
  requireDb(env);
  await ensureSchema(env);

  const [inventoryResult, productsResult, colorsResult, sizesResult] =
    await Promise.all([
      env.DB.prepare("SELECT * FROM inventory").all(),
      env.DB.prepare(
        "SELECT id, name, category, active, product_type FROM products",
      ).all(),
      env.DB.prepare("SELECT id, name, hex FROM product_colors").all(),
      env.DB.prepare("SELECT id, name FROM sizes").all(),
    ]);

  const productById = new Map(
    (productsResult.results || []).map((row) => [row.id, row]),
  );
  const colorById = new Map(
    (colorsResult.results || []).map((row) => [row.id, row]),
  );
  const sizeNames = new Map(
    (sizesResult.results || []).map((row) => [row.id, row.name]),
  );

  const groups = new Map();
  for (const row of inventoryResult.results || []) {
    const product = productById.get(row.product_id);
    // Skip soft-deleted products — their stock is no longer sellable.
    if (!product || !product.active) continue;

    const isSimple = String(product.product_type || "variant") === "simple";

    let group = groups.get(row.product_id);
    if (!group) {
      group = {
        productId: row.product_id,
        productName: product.name,
        category: product.category,
        productType: isSimple ? "simple" : "variant",
        colors: new Map(),
      };
      groups.set(row.product_id, group);
    }

    if (isSimple) {
      // Simple products: a single stock row with no color and no size.
      let colorGroup = group.colors.get(null);
      if (!colorGroup) {
        colorGroup = {
          colorId: null,
          colorName: "Stock",
          hex: null,
          rows: [],
        };
        group.colors.set(null, colorGroup);
      }
      colorGroup.rows.push({
        id: row.id,
        sizeId: null,
        size: null,
        stock: toInt(row.stock),
      });
      continue;
    }

    const color = colorById.get(row.color_id);
    if (!color) continue;

    let colorGroup = group.colors.get(row.color_id);
    if (!colorGroup) {
      colorGroup = {
        colorId: row.color_id,
        colorName: color.name,
        hex: color.hex,
        rows: [],
      };
      group.colors.set(row.color_id, colorGroup);
    }

    colorGroup.rows.push({
      id: row.id,
      sizeId: row.size_id,
      size: sizeNames.get(row.size_id) || row.size_id,
      stock: toInt(row.stock),
    });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    colors: [...group.colors.values()],
  }));
};

/**
 * Set the stock for one inventory row. Updates both the inventory mirror and
 * the matching product_variants row so the storefront stays consistent.
 */
export const updateInventoryStock = async (env, inventoryId, stock) => {
  requireDb(env);
  await ensureSchema(env);

  const parsed = Number(stock);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw apiError(
      "INVALID_STOCK",
      "Stock must be a non-negative number.",
      400,
    );
  }
  const nextStock = Math.trunc(parsed);

  const row = await env.DB
    .prepare("SELECT * FROM inventory WHERE id = ?")
    .bind(inventoryId)
    .first();
  if (!row) {
    throw apiError("INVENTORY_NOT_FOUND", "Inventory row not found.", 404);
  }

  const sizeRow = await env.DB
    .prepare("SELECT name FROM sizes WHERE id = ?")
    .bind(row.size_id)
    .first();

  const statements = [
    env.DB.prepare("UPDATE inventory SET stock = ? WHERE id = ?").bind(
      nextStock,
      inventoryId,
    ),
  ];
  if (sizeRow?.name) {
    statements.push(
      env.DB.prepare(
        "UPDATE product_variants SET stock = ? WHERE product_id = ? AND color_id = ? AND size = ?",
      ).bind(nextStock, row.product_id, row.color_id, sizeRow.name),
    );
  }

  await env.DB.batch(statements);

  return {
    id: inventoryId,
    stock: nextStock,
    productId: row.product_id,
    colorId: row.color_id,
    sizeId: row.size_id,
  };
};
