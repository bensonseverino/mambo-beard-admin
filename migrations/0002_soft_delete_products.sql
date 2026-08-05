-- Migration 0002: Soft-delete products and protect order history.
--
-- order_items previously declared ON DELETE CASCADE on product_id and
-- color_id, so deleting a product -- or editing one, because updateProduct
-- deletes and recreates the row -- silently erased past order line items and
-- customer purchase history.
--
-- Products are now soft-deleted (active = 0) and their rows are never
-- removed, but the destructive cascades are dropped anyway so order history
-- survives any future hard delete. The table is rebuilt (SQLite cannot ALTER
-- a FOREIGN KEY), then indexed for the admin dashboard's order queries.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS order_items_new (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  color_id TEXT NOT NULL,
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

-- Speeds up storefront catalog queries that filter by active.
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);

PRAGMA foreign_keys = ON;
