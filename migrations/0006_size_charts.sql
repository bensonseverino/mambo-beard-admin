-- Migration 0006: Per-product size chart assignment.
--
-- Every product gains an optional size_chart_id referencing the size chart
-- library in src/size-charts.js (e.g. 'size-chart-hoodies'). NULL means the
-- product displays no size chart. Charts are code, not database rows, so the
-- column only stores the assignment.
--
-- Existing products default to NULL (no chart) — nothing is rendered until an
-- admin assigns a chart, so storefront behaviour is unchanged.

ALTER TABLE products ADD COLUMN size_chart_id TEXT;
