-- Append XXL (stock 50) to every product that uses size variations.
-- One product_variants row + one inventory mirror row per color.
-- INSERT OR IGNORE keeps this idempotent against the unique inventory index
-- and the product_variants primary key.

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785765011649-0-XXL', 'prod-1785765269477', 'color-1785765011649-0', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785765011649-0__size-xxl', 'prod-1785765269477', 'color-1785765011649-0', 'size-xxl', 50);

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785847141701-0-XXL', 'prod-1785847630086', 'color-1785847141701-0', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785847141701-0__size-xxl', 'prod-1785847630086', 'color-1785847141701-0', 'size-xxl', 50);
INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785847243349-1-XXL', 'prod-1785847630086', 'color-1785847243349-1', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785847243349-1__size-xxl', 'prod-1785847630086', 'color-1785847243349-1', 'size-xxl', 50);
INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785847490006-2-XXL', 'prod-1785847630086', 'color-1785847490006-2', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785847490006-2__size-xxl', 'prod-1785847630086', 'color-1785847490006-2', 'size-xxl', 50);

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785961994050-2-XXL', 'prod-1785962224002', 'color-1785961994050-2', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785961994050-2__size-xxl', 'prod-1785962224002', 'color-1785961994050-2', 'size-xxl', 50);
INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785961992805-1-XXL', 'prod-1785962224002', 'color-1785961992805-1', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785961992805-1__size-xxl', 'prod-1785962224002', 'color-1785961992805-1', 'size-xxl', 50);
INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785961930089-0-XXL', 'prod-1785962224002', 'color-1785961930089-0', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785961930089-0__size-xxl', 'prod-1785962224002', 'color-1785961930089-0', 'size-xxl', 50);

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785962256709-0-XXL', 'prod-1785962422713', 'color-1785962256709-0', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785962256709-0__size-xxl', 'prod-1785962422713', 'color-1785962256709-0', 'size-xxl', 50);
INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785962348075-1-XXL', 'prod-1785962422713', 'color-1785962348075-1', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785962348075-1__size-xxl', 'prod-1785962422713', 'color-1785962348075-1', 'size-xxl', 50);

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785962457811-0-XXL', 'prod-1785962631271', 'color-1785962457811-0', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785962457811-0__size-xxl', 'prod-1785962631271', 'color-1785962457811-0', 'size-xxl', 50);
INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785962526319-1-XXL', 'prod-1785962631271', 'color-1785962526319-1', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785962526319-1__size-xxl', 'prod-1785962631271', 'color-1785962526319-1', 'size-xxl', 50);

INSERT OR IGNORE INTO product_variants (id, product_id, color_id, size, stock) VALUES ('color-1785982524207-0-XXL', 'prod-1785982559960', 'color-1785982524207-0', 'XXL', 50);
INSERT OR IGNORE INTO inventory (id, product_id, color_id, size_id, stock) VALUES ('color-1785982524207-0__size-xxl', 'prod-1785982559960', 'color-1785982524207-0', 'size-xxl', 50);
