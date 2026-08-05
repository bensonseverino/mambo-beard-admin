// Runtime D1 schema bootstrap.
//
// The D1 database is shared with the storefront and must always contain the
// full schema. Deployments may not have run `wrangler d1 migrations apply`,
// so every API handler bootstraps the schema at runtime with
// CREATE TABLE IF NOT EXISTS — an idempotent, cheap no-op once the tables
// exist. This guarantees `orders` / `order_items` / `inventory` / `sizes`
// are always present and eliminates `no such table` errors.

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS products (
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
  )`,
  `CREATE TABLE IF NOT EXISTS product_colors (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    hex TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS product_images (
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
  )`,
  `CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    color_id TEXT NOT NULL,
    size TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (color_id) REFERENCES product_colors(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sizes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    color_id TEXT NOT NULL,
    size_id TEXT NOT NULL,
    stock INTEGER NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(color_id) REFERENCES product_colors(id) ON DELETE CASCADE,
    FOREIGN KEY(size_id) REFERENCES sizes(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    customer_name TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    delivery_fee INTEGER,
    subtotal INTEGER,
    total INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    color_id TEXT NOT NULL,
    size TEXT,
    size_id TEXT,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY(color_id) REFERENCES product_colors(id) ON DELETE CASCADE,
    FOREIGN KEY(size_id) REFERENCES sizes(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    name TEXT,
    email TEXT,
    location TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    lifetime_spend INTEGER NOT NULL DEFAULT 0,
    last_order_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone)`,
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

export const SIZE_SEED_STATEMENT = `INSERT OR IGNORE INTO sizes (id, name) VALUES
  ('size-xs', 'XS'),
  ('size-s', 'S'),
  ('size-m', 'M'),
  ('size-l', 'L'),
  ('size-xl', 'XL')`;

/**
 * Create every table (idempotent) and seed the standard sizes.
 * Safe to call on every API request — no-op once the schema exists.
 */
export const ensureSchema = async (env) => {
  const db = env?.DB;
  if (!db) return;
  const indexStatement = SCHEMA_STATEMENTS.find((sql) =>
    sql.startsWith("CREATE UNIQUE INDEX"),
  );
  const statements = SCHEMA_STATEMENTS.filter(
    (sql) => !sql.startsWith("CREATE UNIQUE INDEX"),
  ).map((sql) => db.prepare(sql));
  statements.push(db.prepare(SIZE_SEED_STATEMENT));
  await db.batch(statements);

  // A pre-existing customers table with duplicate phones would make the
  // unique index fail to build. Catch it so one dirty table can't take down
  // every handler that bootstraps the schema.
  if (indexStatement) {
    try {
      await db.prepare(indexStatement).run();
    } catch (error) {
      console.warn(
        "[schema] Could not create unique index on customers(phone):",
        error?.message || error,
      );
    }
  }
};

/** Require the D1 binding; throws a structured error when it is missing. */
export const requireDb = (env) => {
  if (!env?.DB) {
    throw apiError(
      "D1_BINDING_ERROR",
      "Database binding DB is not configured.",
      500,
    );
  }
  return env.DB;
};

/** Throw a structured API error that errorResponse() can render. */
export const apiError = (code, message, status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

/** Render any thrown error as a structured JSON response. */
export const errorResponse = (error) => {
  const status = error?.status || 500;
  const isServerError = status >= 500;
  if (isServerError) {
    console.error("[api]", error?.message || error);
  }
  return Response.json(
    {
      success: false,
      message: isServerError ? "Internal server error." : error.message,
      code: error.code || (isServerError ? "D1_ERROR" : "API_ERROR"),
    },
    { status },
  );
};
