import { apiError, ensureSchema } from "./schema.js";

// Per-product variation configuration. The admin dashboard is the source of
// truth: every product carries exactly one of these values.
//
//   'none'       — simple product: one price, one stock figure, no selectors
//   'color'      — customers pick a color only
//   'size'       — customers pick a size only
//   'color_size' — customers pick both a color and a size
export const VARIATION_TYPES = ["none", "color", "size", "color_size"];

export const hasColorVariation = (type) => type === "color" || type === "color_size";
export const hasSizeVariation = (type) => type === "size" || type === "color_size";

const slugifyValue = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "product";

const buildPreviewUrl = (path) =>
  path ? `/api/media/${encodeURIComponent(path)}` : "";

const buildColorId = (index) => `color-${Date.now()}-${index}`;
const buildImageId = (index) => `image-${Date.now()}-${index}`;

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

// Canonical display order for the size catalog (alphabetical order would put
// L before M and S). Any unknown size sorts after the standard list.
const STANDARD_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
const sizeRank = (name) => {
  const index = STANDARD_SIZE_ORDER.indexOf(String(name || "").trim());
  return index === -1 ? STANDARD_SIZE_ORDER.length : index;
};
const sortSizes = (sizes) =>
  [...sizes].sort((a, b) => sizeRank(a.name) - sizeRank(b.name));

/** Normalize an image entry into the canonical shape used everywhere. */
const normalizeImages = (images) =>
  (Array.isArray(images) ? images : []).map((image, index) => ({
    id: image?.id || buildImageId(index),
    path: String(image?.path || "").trim(),
    type: String(image?.type || "gallery"),
    fileName: String(
      image?.fileName ||
        image?.path?.split("/").pop() ||
        `asset-${index + 1}`,
    ),
    size: Number(image?.size || 0),
    uploadedAt: String(image?.uploadedAt || new Date().toISOString()),
    isPrimary: Boolean(image?.isPrimary),
    sortOrder: Number(image?.sortOrder || index + 1),
  }));

const normalizeVariants = (variants, fallbackSizes) => {
  const source =
    Array.isArray(variants) && variants.length ? variants : fallbackSizes;
  return source.map((variant, index) => ({
    size: String(variant?.size || fallbackSizes?.[index]?.size || "S"),
    stock: Math.max(0, toInt(variant?.stock)),
  }));
};

const normalizeColors = (colors, colorSize) => {
  const source = Array.isArray(colors) && colors.length ? colors : [];
  const fallbackSizes = ["S", "M", "L", "XL", "XXL"].map((size) => ({
    size,
    stock: 0,
  }));
  return source.map((color, index) => {
    const variants = colorSize
      ? normalizeVariants(color?.variants, fallbackSizes)
      : [
          // Color-only products track one stock figure per color (size null).
          {
            size: null,
            stock: Math.max(
              0,
              toInt(
                color?.stock ??
                  color?.variants?.[0]?.stock ??
                  0,
              ),
            ),
          },
        ];
    return {
      id: color?.id || buildColorId(index),
      name: String(color?.name || `Color ${index + 1}`).trim(),
      hex: String(color?.hex || "#111827"),
      sortOrder: Number(color?.sortOrder || index + 1),
      images: normalizeImages(color?.images),
      variants,
    };
  });
};

const normalizeSizes = (sizes) =>
  (Array.isArray(sizes) ? sizes : []).map((size, index) => ({
    id: String(
      size?.id || `size-${slugifyValue(size?.name || `size-${index + 1}`)}`,
    ),
    name: String(size?.name || size?.id || `Size ${index + 1}`),
    stock: Math.max(0, toInt(size?.stock)),
  }));

/**
 * Normalize an admin payload into the canonical product shape. The four
 * variation modes change which fields are meaningful:
 *
 *   none       → stock + gallery (no colors, no sizes)
 *   color      → colors with one stock figure each
 *   size       → sizes with one stock figure each
 *   color_size → colors with per-size variants + the selected sizes
 *
 * Legacy payloads that still send productType are mapped: simple → none,
 * variant → color_size.
 */
export const normalizeProductPayload = (product) => {
  const safeProduct = product || {};
  const variationType = VARIATION_TYPES.includes(safeProduct.variationType)
    ? safeProduct.variationType
    : safeProduct.productType === "simple"
      ? "none"
      : "color_size";
  const color = hasColorVariation(variationType);
  const size = hasSizeVariation(variationType);

  const colors = color ? normalizeColors(safeProduct.colors, variationType === "color_size") : [];
  const sizes = size ? normalizeSizes(safeProduct.sizes) : [];

  // Simple/size-only products own a single color-less gallery. When a
  // payload switches a color-bearing product to one of these modes without a
  // gallery, the existing per-color images are flattened into the gallery
  // instead of being discarded.
  const gallery =
    color
      ? []
      : normalizeImages(
          Array.isArray(safeProduct.gallery) && safeProduct.gallery.length
            ? safeProduct.gallery
            : (safeProduct.colors || []).flatMap((c) => c.images || []),
        );

  return {
    id: String(safeProduct.id || `prod-${Date.now()}`),
    name: String(safeProduct.name || "").trim(),
    slug: slugifyValue(safeProduct.slug || safeProduct.name),
    description: String(safeProduct.description || "").trim(),
    price: Number(safeProduct.price || 0),
    category: String(safeProduct.category || "Care").trim(),
    featured: Boolean(safeProduct.featured),
    active: safeProduct.active !== false,
    variationType,
    productType: variationType === "none" ? "simple" : "variant",
    stock:
      variationType === "none" ? Math.max(0, toInt(safeProduct.stock)) : null,
    gallery,
    colors,
    sizes,
  };
};

const mapImageRow = (row) => ({
  id: row.id,
  productId: row.product_id,
  colorId: row.color_id,
  path: row.path,
  previewUrl: buildPreviewUrl(row.path),
  type: row.type,
  fileName: row.file_name,
  size: row.size,
  uploadedAt: row.uploaded_at,
  isPrimary: Boolean(row.is_primary),
  sortOrder: row.sort_order,
});

const mapColorRow = (row, images, variants) => ({
  id: row.id,
  name: row.name,
  hex: row.hex,
  sortOrder: row.sort_order,
  images,
  variants,
});

/**
 * Build the storefront/admin-facing variation payload for one product row.
 * Shared by listProducts and getProductDetail so both endpoints agree on the
 * shape. `variationType` decides what is surfaced:
 *
 *   none       → gallery + stock
 *   color      → colors (one stock per color)
 *   size       → sizes (one stock per size) + gallery
 *   color_size → colors (per-size stock) + sizes
 */
const buildProductVariation = (
  product,
  {
    colorsByProduct,
    imagesByColor,
    galleryByProduct,
    variantsByColor,
    inventoryByProduct,
    sizeNamesById,
    colorStockByProduct,
  },
) => {
  const variationType = VARIATION_TYPES.includes(product.variation_type)
    ? product.variation_type
    : String(product.product_type || "variant") === "simple"
      ? "none"
      : "color_size";
  const color = hasColorVariation(variationType);
  const size = hasSizeVariation(variationType);

  let colors = [];
  if (color) {
    colors = (colorsByProduct.get(product.id) || []).map((colorRow) => {
      let variants;
      if (variationType === "color_size") {
        variants = sortSizes(
          (variantsByColor.get(colorRow.id) || []).map((variant) => ({
            size: variant.size,
            stock: variant.stock,
          })),
        );
      } else {
        const stockRow = (colorStockByProduct.get(product.id) || []).find(
          (entry) => entry.colorId === colorRow.id,
        );
        variants = [{ size: null, stock: stockRow ? stockRow.stock : 0 }];
      }
      return mapColorRow(
        colorRow,
        imagesByColor.get(colorRow.id) || [],
        variants,
      );
    });
  }

  let sizes = [];
  if (size) {
    const rows = inventoryByProduct.get(product.id) || [];
    if (variationType === "size") {
      // Size-only: one stock figure per size (no color dimension).
      sizes = sortSizes(
        rows
          .filter((entry) => entry.colorId == null && entry.sizeId != null)
          .map((entry) => ({
            id: entry.sizeId,
            name: sizeNamesById.get(entry.sizeId) || entry.sizeId,
            stock: entry.stock,
          })),
      );
    } else {
      // Color + size: the selected sizes are the union of the inventory rows.
      const seen = new Map();
      for (const entry of rows) {
        if (entry.colorId == null || entry.sizeId == null) continue;
        if (!seen.has(entry.sizeId)) {
          seen.set(entry.sizeId, {
            id: entry.sizeId,
            name: sizeNamesById.get(entry.sizeId) || entry.sizeId,
          });
        }
      }
      sizes = sortSizes([...seen.values()]);
    }
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    category: product.category,
    featured: Boolean(product.featured),
    active: Boolean(product.active),
    variationType,
    productType: variationType === "none" ? "simple" : "variant",
    colors,
    sizes,
    gallery: color ? [] : galleryByProduct.get(product.id) || [],
    stock:
      variationType === "none"
        ? (colorStockByProduct.get(product.id) || [])[0]?.stock ?? null
        : null,
  };
};

export const listProducts = async (env, options = {}) => {
  if (!env?.DB) return [];
  await ensureSchema(env);

  // The storefront catalog only sees active products; the admin passes
  // includeInactive to see soft-deleted products and restore them.
  const activeClause = options.includeInactive ? "" : " WHERE active = 1";

  const [productsResult, colorsResult, imagesResult, variantsResult, inventoryResult, sizesResult] =
    await Promise.all([
      env.DB.prepare(
        `SELECT * FROM products${activeClause} ORDER BY created_at DESC`,
      ).all(),
      env.DB.prepare(
        "SELECT * FROM product_colors ORDER BY sort_order ASC, created_at DESC",
      ).all(),
      env.DB.prepare(
        "SELECT * FROM product_images ORDER BY sort_order ASC, uploaded_at DESC",
      ).all(),
      env.DB.prepare("SELECT * FROM product_variants ORDER BY size ASC").all(),
      env.DB.prepare(
        "SELECT product_id, color_id, size_id, stock FROM inventory",
      ).all(),
      env.DB.prepare("SELECT id, name FROM sizes").all(),
    ]);

  const sizeNamesById = new Map(
    (sizesResult.results || []).map((row) => [row.id, row.name]),
  );

  const imagesByColor = new Map();
  const galleryByProduct = new Map();
  for (const image of imagesResult.results || []) {
    const mapped = mapImageRow(image);
    if (image.color_id == null) {
      // Product-level gallery image (simple / size-only products).
      const existing = galleryByProduct.get(image.product_id) || [];
      existing.push(mapped);
      galleryByProduct.set(image.product_id, existing);
      continue;
    }
    const existing = imagesByColor.get(image.color_id) || [];
    existing.push(mapped);
    imagesByColor.set(image.color_id, existing);
  }

  const colorStockByProduct = new Map();
  const inventoryByProduct = new Map();
  for (const row of inventoryResult.results || []) {
    const entry = {
      colorId: row.color_id,
      sizeId: row.size_id,
      stock: toInt(row.stock),
    };
    const existing = inventoryByProduct.get(row.product_id) || [];
    existing.push(entry);
    inventoryByProduct.set(row.product_id, existing);

    // Rows without a size carry product-level stock (NULL color) or
    // per-color stock for color-only products.
    if (row.size_id == null) {
      const productStock = colorStockByProduct.get(row.product_id) || [];
      productStock.push(entry);
      colorStockByProduct.set(row.product_id, productStock);
    }
  }

  const variantsByColor = new Map();
  for (const variant of variantsResult.results || []) {
    const existing = variantsByColor.get(variant.color_id) || [];
    existing.push({ size: variant.size, stock: variant.stock });
    variantsByColor.set(variant.color_id, existing);
  }

  const colorsByProduct = new Map();
  for (const color of colorsResult.results || []) {
    const existing = colorsByProduct.get(color.product_id) || [];
    existing.push(color);
    colorsByProduct.set(color.product_id, existing);
  }

  const context = {
    colorsByProduct,
    imagesByColor,
    galleryByProduct,
    variantsByColor,
    inventoryByProduct,
    sizeNamesById,
    colorStockByProduct,
  };

  return (productsResult.results || []).map((product) =>
    buildProductVariation(product, context),
  );
};

const insertProductStatement = (db, product) =>
  db
    .prepare(
      `
    INSERT INTO products (id, name, slug, description, price, category, featured, active, product_type, variation_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      product.id,
      product.name,
      product.slug,
      product.description,
      product.price,
      product.category,
      product.featured ? 1 : 0,
      product.active ? 1 : 0,
      product.productType === "simple" ? "simple" : "variant",
      product.variationType,
      product.createdAt,
      product.updatedAt,
    );

const insertColorStatement = (db, productId, color, createdAt) =>
  db
    .prepare(
      `
    INSERT INTO product_colors (id, product_id, name, hex, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      color.id,
      productId,
      color.name,
      color.hex,
      color.sortOrder,
      createdAt,
      createdAt,
    );

const insertImageStatement = (db, productId, colorId, image, createdAt) =>
  db
    .prepare(
      `
    INSERT INTO product_images (id, product_id, color_id, path, type, file_name, size, uploaded_at, is_primary, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      image.id,
      productId,
      colorId,
      image.path,
      image.type,
      image.fileName,
      image.size,
      image.uploadedAt || createdAt,
      image.isPrimary ? 1 : 0,
      image.sortOrder,
    );

const insertVariantStatement = (db, productId, colorId, variant) =>
  db
    .prepare(
      `
    INSERT INTO product_variants (id, product_id, color_id, size, stock)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .bind(
      `${colorId}-${variant.size}`,
      productId,
      colorId,
      variant.size,
      variant.stock,
    );

const addPreviewUrls = (product) => ({
  ...product,
  colors: (product.colors || []).map((color) => ({
    ...color,
    images: (color.images || []).map((image) => ({
      ...image,
      previewUrl: buildPreviewUrl(image.path),
    })),
  })),
  gallery: (product.gallery || []).map((image) => ({
    ...image,
    previewUrl: buildPreviewUrl(image.path),
  })),
});

export const createProduct = async (env, payload) => {
  if (!env?.DB) return normalizeProductPayload(payload);
  await ensureSchema(env);
  const normalized = normalizeProductPayload(payload);
  const now = new Date().toISOString();
  const product = { ...normalized, createdAt: now, updatedAt: now };

  // ── none: one gallery + one stock figure, no colors or sizes ──────────
  if (product.variationType === "none") {
    const statements = [insertProductStatement(env.DB, product)];
    for (const image of product.gallery || []) {
      statements.push(
        insertImageStatement(env.DB, product.id, null, image, now),
      );
    }
    statements.push(
      env.DB
        .prepare(
          `INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock)
           VALUES (?, ?, NULL, NULL, ?)`,
        )
        .bind(`stock-${product.id}`, product.id, product.stock),
    );
    await env.DB.batch(statements);
    return addPreviewUrls(product);
  }

  const statements = [insertProductStatement(env.DB, product)];

  const sizeRows = await env.DB.prepare("SELECT id, name FROM sizes").all();
  const sizeIds = new Map(
    (sizeRows.results || []).map((row) => [row.name, row.id]),
  );

  // `size` is either a color variant ({ size: "M", stock }) or a size-only
  // entry ({ id, name, stock }); resolve the catalog row by its name.
  const ensureSizeRow = (size) => {
    const name = String(size.name || size.size || "").trim();
    let sizeId = name ? sizeIds.get(name) : undefined;
    if (!sizeId) {
      sizeId = size.id || `size-${slugifyValue(name || "size")}`;
      statements.push(
        env.DB
          .prepare("INSERT OR IGNORE INTO sizes (id, name) VALUES (?, ?)")
          .bind(sizeId, name),
      );
      if (name) sizeIds.set(name, sizeId);
    }
    return sizeId;
  };

  // ── color: colors with one stock figure each (size stays NULL) ────────
  if (product.variationType === "color") {
    for (const color of product.colors) {
      statements.push(insertColorStatement(env.DB, product.id, color, now));
      for (const image of color.images || []) {
        statements.push(
          insertImageStatement(env.DB, product.id, color.id, image, now),
        );
      }
      const stock = color.variants?.[0]?.stock ?? 0;
      statements.push(
        env.DB
          .prepare(
            `INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock)
             VALUES (?, ?, ?, NULL, ?)`,
          )
          .bind(`inv-${product.id}-${color.id}`, product.id, color.id, stock),
      );
    }
    await env.DB.batch(statements);
    return addPreviewUrls(product);
  }

  // ── size: sizes with one stock figure each (color stays NULL) ─────────
  if (product.variationType === "size") {
    for (const size of product.sizes) {
      const sizeId = ensureSizeRow(size);
      statements.push(
        env.DB
          .prepare(
            `INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock)
             VALUES (?, ?, NULL, ?, ?)`,
          )
          .bind(`inv-${product.id}-${sizeId}`, product.id, sizeId, size.stock),
      );
    }
    await env.DB.batch(statements);
    return addPreviewUrls(product);
  }

  // ── color_size: per-color variants + inventory mirror (default) ───────
  for (const color of product.colors) {
    statements.push(insertColorStatement(env.DB, product.id, color, now));
    for (const image of color.images || []) {
      statements.push(
        insertImageStatement(env.DB, product.id, color.id, image, now),
      );
    }
    for (const variant of color.variants || []) {
      statements.push(
        insertVariantStatement(env.DB, product.id, color.id, variant),
      );
      const sizeId = ensureSizeRow(variant);
      statements.push(
        env.DB
          .prepare(
            `INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            `${color.id}__${sizeId}`,
            product.id,
            color.id,
            sizeId,
            variant.stock,
          ),
      );
    }
  }

  await env.DB.batch(statements);

  // The response reflects the sizes the product actually uses (derived from
  // the per-color variants, in canonical order).
  const sizeNameSet = new Map();
  for (const color of product.colors) {
    for (const variant of color.variants || []) {
      const name = String(variant.size || "").trim();
      if (!name) continue;
      sizeNameSet.set(name, {
        id: sizeIds.get(name) || `size-${slugifyValue(name)}`,
        name,
      });
    }
  }
  return addPreviewUrls({ ...product, sizes: sortSizes([...sizeNameSet.values()]) });
};

export const updateProduct = async (env, productId, payload) => {
  if (!env?.DB) return normalizeProductPayload({ ...payload, id: productId });
  await ensureSchema(env);

  // Partial updates that only touch the active flag (e.g. restore from a
  // soft delete) update the flag directly instead of rebuilding the product.
  // The guard is strict: `active` must be the sole key in the payload so a
  // full product update can never be misclassified.
  const payloadKeys = payload && typeof payload === "object" ? Object.keys(payload) : [];
  if (payloadKeys.length === 1 && payload.active !== undefined) {
    const result = await env.DB.prepare(
      "UPDATE products SET active = ?, updated_at = ? WHERE id = ?",
    )
      .bind(payload.active ? 1 : 0, new Date().toISOString(), productId)
      .run();
    if (!result?.meta?.changes) {
      throw apiError("PRODUCT_NOT_FOUND", "Product not found.", 404);
    }
    return { id: productId, active: Boolean(payload.active) };
  }

  const normalized = normalizeProductPayload({ ...payload, id: productId });
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare("DELETE FROM inventory WHERE product_id = ?").bind(
      productId,
    ),
    env.DB.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(
      productId,
    ),
    env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(
      productId,
    ),
    env.DB.prepare("DELETE FROM product_colors WHERE product_id = ?").bind(
      productId,
    ),
    env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId),
  ];
  await env.DB.batch(statements);
  return createProduct(env, { ...normalized, createdAt: now, updatedAt: now });
};

export const deleteProduct = async (env, productId) => {
  if (!env?.DB) return true;
  await ensureSchema(env);

  // Soft delete: hide the product from the storefront and keep every row so
  // order history, customer purchases, and inventory stay intact. A product
  // can be restored later by setting active = 1.
  const result = await env.DB.prepare(
    "UPDATE products SET active = 0, updated_at = ? WHERE id = ?",
  )
    .bind(new Date().toISOString(), productId)
    .run();
  if (!result?.meta?.changes) {
    throw apiError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }
  return true;
};

/**
 * Load a single product by id OR slug with colors, images, and inventory.
 * Returns null when not found.
 */
export const getProductDetail = async (env, key) => {
  if (!env?.DB) return null;
  await ensureSchema(env);

  // Storefront-facing detail: soft-deleted products are not viewable.
  const product = await env.DB
    .prepare("SELECT * FROM products WHERE (id = ? OR slug = ?) AND active = 1")
    .bind(key, key)
    .first();
  if (!product) return null;

  const [colorsResult, imagesResult, variantsResult, inventoryResult, sizesResult] =
    await Promise.all([
      env.DB.prepare(
        "SELECT * FROM product_colors WHERE product_id = ? ORDER BY sort_order ASC, created_at DESC",
      )
        .bind(product.id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, uploaded_at DESC",
      )
        .bind(product.id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM product_variants WHERE product_id = ? ORDER BY size ASC",
      )
        .bind(product.id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM inventory WHERE product_id = ?",
      )
        .bind(product.id)
        .all(),
      env.DB.prepare("SELECT id, name FROM sizes").all(),
    ]);

  const sizeNamesById = new Map(
    (sizesResult.results || []).map((row) => [row.id, row.name]),
  );

  const images = (imagesResult.results || []).map(mapImageRow);
  const imagesByColor = new Map();
  const galleryByProduct = new Map();
  for (const image of images) {
    if (image.colorId == null) {
      const existing = galleryByProduct.get(product.id) || [];
      existing.push(image);
      galleryByProduct.set(product.id, existing);
      continue;
    }
    const existing = imagesByColor.get(image.colorId) || [];
    existing.push(image);
    imagesByColor.set(image.colorId, existing);
  }

  const variantsByColor = new Map();
  for (const variant of variantsResult.results || []) {
    const existing = variantsByColor.get(variant.color_id) || [];
    existing.push({ size: variant.size, stock: variant.stock });
    variantsByColor.set(variant.color_id, existing);
  }

  const inventoryByProduct = new Map();
  const colorStockByProduct = new Map();
  for (const row of inventoryResult.results || []) {
    const entry = {
      id: row.id,
      productId: row.product_id,
      colorId: row.color_id,
      sizeId: row.size_id,
      stock: row.stock,
      size: null,
    };
    const existing = inventoryByProduct.get(product.id) || [];
    existing.push(entry);
    inventoryByProduct.set(product.id, existing);

    if (row.size_id == null) {
      const productStock = colorStockByProduct.get(product.id) || [];
      productStock.push(entry);
      colorStockByProduct.set(product.id, productStock);
    }
  }

  // Resolve size names from the already-fetched catalog (the table is tiny,
  // so no IN (...) query is needed).
  for (const entry of inventoryByProduct.get(product.id) || []) {
    if (entry.sizeId != null) {
      entry.size = sizeNamesById.get(entry.sizeId) || entry.sizeId;
    }
  }

  const colorsByProduct = new Map();
  colorsByProduct.set(
    product.id,
    (colorsResult.results || []).map((color) => color),
  );

  const built = buildProductVariation(product, {
    colorsByProduct,
    imagesByColor,
    galleryByProduct,
    variantsByColor,
    inventoryByProduct,
    sizeNamesById,
    colorStockByProduct,
  });

  const thumbnail =
    images.find((image) => image.isPrimary)?.previewUrl || images[0]?.previewUrl || "";

  return {
    product: {
      id: built.id,
      name: built.name,
      slug: built.slug,
      description: built.description,
      price: built.price,
      category: built.category,
      featured: built.featured,
      active: built.active,
      variationType: built.variationType,
      productType: built.productType,
    },
    colors: built.colors,
    sizes: built.sizes,
    images,
    gallery: built.gallery,
    stock: built.stock,
    inventory: inventoryByProduct.get(product.id) || [],
    thumbnail,
  };
};
