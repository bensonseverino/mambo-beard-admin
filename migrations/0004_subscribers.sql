-- Migration 0004: VIP subscribers.
--
-- Collects phone numbers from the storefront popup. POST /api/subscribers is
-- public (no auth) and rate-limited to 5 requests per IP per hour.

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active',
  source TEXT DEFAULT 'website'
);

CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers (created_at DESC);

-- Rolling per-IP, per-hour request counters for the subscription popup.
-- `id` is the composite key `ip|YYYY-MM-DD-HH`, so PRIMARY KEY already
-- enforces uniqueness; the extra unique index is a query-time optimisation.
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_ip_bucket ON rate_limits (ip, bucket);
