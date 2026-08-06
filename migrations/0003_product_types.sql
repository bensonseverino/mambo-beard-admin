-- Migration 0003: Support simple products (no colors / no sizes).
--
-- Products gain a product_type column:
--   'variant' (default) — colors, sizes, per-variant inventory (apparel)
--   'simple'            — one price, one stock figure, one color-less gallery
--                         (tote bags, mugs, stickers, posters, caps, ...)
--
-- Simple products store:
--   * images in product_images with color_id NULL  (a single gallery)
--   * a single inventory row with color_id NULL, size_id NULL
--   * order line items with color_id NULL, size_id NULL
--
-- SQLite cannot ALTER a column constraint, so product_images, inventory, and
-- order_items are rebuilt with nullable color_id / size_id (the same pattern
-- as migration 0002). order_items keeps the non-destructive product/color
-- foreign keys from 0002 so order history always survives.

ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'variant';

PRAGMA foreign_keys = OFF;

-- product_images: color_id is now nullable; NULL means a simple-product
-- gallery image (not attached to any color).
CREATE TABLE IF NOT EXISTS product_images_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  color_id TEXT,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (color_id) REFERENCES product_colors(id) ON DELETE CASCADE
);

INSERT INTO product_images_new (id, product_id, color_id, path, type, file_name, size, uploaded_at, is_primary, sort_order)
  SELECT id, product_id, color_id, path, type, file_name, size, uploaded_at, is_primary, sort_order
  FROM product_images;

DROP TABLE product_images;

ALTER TABLE product_images_new RENAME TO product_images;

-- inventory: color_id / size_id are now nullable; a simple product stores a
-- single row with NULL / NULL.
CREATE TABLE IF NOT EXISTS inventory_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  color_id TEXT,
  size_id TEXT,
  stock INTEGER NOT NULL,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY(color_id) REFERENCES product_colors(id) ON DELETE CASCADE,
  FOREIGN KEY(size_id) REFERENCES sizes(id) ON DELETE CASCADE
);

INSERT INTO inventory_new (id, product_id, color_id, size_id, stock)
  SELECT id, product_id, color_id, size_id, stock
  FROM inventory;

DROP TABLE inventory;

ALTER TABLE inventory_new RENAME TO inventory;

-- order_items: color_id is now nullable so simple-product order lines store
-- NULL; size_id was already nullable.
CREATE TABLE IF NOT EXISTS order_items_new (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  color_id TEXT,
  size TEXT,
  size_id TEXT,
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(color_id) REFERENCES product_colors(id),
  FOREIGN KEY(size_id) REFERENCES sizes(id) ON DELETE CASCADE
);

INSERT INTO order_items_new (id, order_id, product_id, color_id, size, size_id, quantity, price)
  SELECT id, order_id, product_id, color_id, size, size_id, quantity, price
  FROM order_items;

DROP TABLE order_items;

ALTER TABLE order_items_new RENAME TO order_items;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- Speeds up inventory listing/checkout lookups by simple-product stock.
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory (product_id);

PRAGMA foreign_keys = ON;
