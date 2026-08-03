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

export const normalizeProductPayload = (product) => {
  const safeProduct = product || {};
  const normalizedColors =
    Array.isArray(safeProduct.colors) && safeProduct.colors.length
      ? safeProduct.colors.map((color, index) => ({
          id: color?.id || buildColorId(index),
          name: String(color?.name || `Color ${index + 1}`).trim(),
          hex: String(color?.hex || "#111827"),
          sortOrder: Number(color?.sortOrder || index + 1),
          images: Array.isArray(color?.images)
            ? color.images.map((image, imageIndex) => ({
                id: image?.id || buildImageId(imageIndex),
                path: String(image?.path || "").trim(),
                type: String(image?.type || "gallery"),
                fileName: String(
                  image?.fileName ||
                    image?.path?.split("/").pop() ||
                    `asset-${imageIndex + 1}`,
                ),
                size: Number(image?.size || 0),
                uploadedAt: String(
                  image?.uploadedAt || new Date().toISOString(),
                ),
                isPrimary: Boolean(image?.isPrimary),
                sortOrder: Number(image?.sortOrder || imageIndex + 1),
              }))
            : [],
          variants:
            Array.isArray(color?.variants) && color.variants.length
              ? color.variants.map((variant) => ({
                  size: String(variant?.size || "M"),
                  stock: Number(variant?.stock || 0),
                }))
              : [
                  { size: "XS", stock: 0 },
                  { size: "S", stock: 0 },
                  { size: "M", stock: 0 },
                  { size: "L", stock: 0 },
                  { size: "XL", stock: 0 },
                ],
        }))
      : [
          {
            id: buildColorId(0),
            name: "Default",
            hex: "#111827",
            sortOrder: 1,
            images: [],
            variants: [
              { size: "XS", stock: 0 },
              { size: "S", stock: 0 },
              { size: "M", stock: 0 },
              { size: "L", stock: 0 },
              { size: "XL", stock: 0 },
            ],
          },
        ];

  return {
    id: String(safeProduct.id || `prod-${Date.now()}`),
    name: String(safeProduct.name || "").trim(),
    slug: slugifyValue(safeProduct.slug || safeProduct.name),
    description: String(safeProduct.description || "").trim(),
    price: Number(safeProduct.price || 0),
    category: String(safeProduct.category || "Care").trim(),
    featured: Boolean(safeProduct.featured),
    active: safeProduct.active !== false,
    colors: normalizedColors,
  };
};

const createSchemaStatements = (db) => [
  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `),
  db.prepare(`
    CREATE TABLE IF NOT EXISTS product_colors (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hex TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `),
  db.prepare(`
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES product_colors(id) ON DELETE CASCADE
    )
  `),
  db.prepare(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES product_colors(id) ON DELETE CASCADE
    )
  `),
];

export const ensureProductSchema = async (env) => {
  if (!env?.DB) return;
  const statements = createSchemaStatements(env.DB);
  await env.DB.batch(statements);
};

const mapImageRow = (row) => ({
  id: row.id,
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

export const listProducts = async (env) => {
  if (!env?.DB) return [];
  await ensureProductSchema(env);

  const [productsResult, colorsResult, imagesResult, variantsResult] =
    await Promise.all([
      env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all(),
      env.DB.prepare(
        "SELECT * FROM product_colors ORDER BY sort_order ASC, created_at DESC",
      ).all(),
      env.DB.prepare(
        "SELECT * FROM product_images ORDER BY sort_order ASC, uploaded_at DESC",
      ).all(),
      env.DB.prepare("SELECT * FROM product_variants ORDER BY size ASC").all(),
    ]);

  const imagesByColor = new Map();
  for (const image of imagesResult.results || []) {
    const existing = imagesByColor.get(image.color_id) || [];
    existing.push(mapImageRow(image));
    imagesByColor.set(image.color_id, existing);
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
    existing.push(
      mapColorRow(
        color,
        imagesByColor.get(color.id) || [],
        variantsByColor.get(color.id) || [],
      ),
    );
    colorsByProduct.set(color.product_id, existing);
  }

  return (productsResult.results || []).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    category: product.category,
    featured: Boolean(product.featured),
    active: Boolean(product.active),
    colors: colorsByProduct.get(product.id) || [],
  }));
};

const insertProductStatement = (db, product) =>
  db
    .prepare(
      `
    INSERT INTO products (id, name, slug, description, price, category, featured, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

export const createProduct = async (env, payload) => {
  if (!env?.DB) return normalizeProductPayload(payload);
  await ensureProductSchema(env);
  const normalized = normalizeProductPayload(payload);
  const now = new Date().toISOString();
  const product = { ...normalized, createdAt: now, updatedAt: now };
  const statements = [insertProductStatement(env.DB, product)];

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
    }
  }

  await env.DB.batch(statements);
  return {
    ...product,
    colors: product.colors.map((color) => ({
      ...color,
      images: (color.images || []).map((image) => ({
        ...image,
        previewUrl: buildPreviewUrl(image.path),
      })),
    })),
  };
};

export const updateProduct = async (env, productId, payload) => {
  if (!env?.DB) return normalizeProductPayload({ ...payload, id: productId });
  await ensureProductSchema(env);
  const normalized = normalizeProductPayload({ ...payload, id: productId });
  const now = new Date().toISOString();
  const statements = [
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
  await ensureProductSchema(env);
  const statements = [
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
  return true;
};
