-- Migration 0005: Per-product variation types and the XXL size.
--
-- Every product gains a variation_type column with one of four values:
--   'none'       — simple product: one price, one stock figure, no selectors
--   'color'      — customers pick a color only
--   'size'       — customers pick a size only (S, M, L, XL, XXL, ...)
--   'color_size' — customers pick both a color and a size (the historical
--                  'variant' behaviour)
--
-- Existing products are mapped by their current product_type:
--   'simple'  → 'none'      (single stock row, color-less gallery)
--   'variant' → 'color_size' (variant products always carried colors + sizes)
--
-- Nothing is deleted: colors, sizes, inventory, and order history survive so
-- the storefront keeps working exactly as before for existing products.

ALTER TABLE products ADD COLUMN variation_type TEXT NOT NULL DEFAULT 'color_size';

UPDATE products SET variation_type = 'none' WHERE product_type = 'simple';

-- The standard size catalog becomes S, M, L, XL, XXL. XS already exists in
-- the catalog and is intentionally kept (no data is removed).
INSERT OR IGNORE INTO sizes (id, name) VALUES ('size-xxl', 'XXL');

-- Prevent duplicate stock rows for the same variation combination. SQLite
-- treats NULLs as distinct in a plain unique index, so the nullable
-- color_id / size_id are coalesced to '' for the index (color-only rows are
-- (product, color, '') and size-only rows are (product, '', size)).
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_variation
  ON inventory (product_id, COALESCE(color_id, ''), COALESCE(size_id, ''));
