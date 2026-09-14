-- Migration 0007: Store the resolved size chart the storefront renders.
--
-- products.size_chart_id (migration 0006) keeps the admin's selection from the
-- chart library in src/size-charts.js. The storefront renders columns/rows, so
-- the admin also writes that chart resolved into the storefront shape as JSON
-- on every save:
--
--   {"columns":["Chest (in)","Length (in)"],
--    "rows":[{"size":"S","measurements":["34","26"]}]}
--
-- Both columns are written together (and both cleared when a product has no
-- chart), so the assignment and the rendered payload can never drift.
--
-- The runtime bootstrap in functions/lib/schema.js backfills this column, so
-- this file only matters for `wrangler d1 migrations apply` users. Existing
-- products default to NULL — nothing renders until an admin assigns a chart.

ALTER TABLE products ADD COLUMN size_chart TEXT;
