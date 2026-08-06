// VIP subscriber operations.
//
// Collects phone numbers from the storefront popup into D1. The popup POST is
// public (no admin auth) and rate-limited to 5 requests per IP per hour;
// listing, exporting, and deleting are admin-only.

import { apiError, ensureSchema, requireDb } from "./schema.js";

export const RATE_LIMIT_MAX = 5;

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

// SQLite/D1 reports duplicate-key failures as SQLITE_CONSTRAINT_UNIQUE
// (D1 surfaces it in error.cause.code or a "UNIQUE constraint failed"
// message). Only those genuinely mean the phone already exists.
const isUniqueViolation = (error) => {
  const code = String(error?.cause?.code || error?.code || "");
  if (code.includes("SQLITE_CONSTRAINT")) return true;
  const message = String(error?.message || error?.cause?.message || "");
  return message.toLowerCase().includes("unique constraint");
};

const mapSubscriberRow = (row) => ({
  id: row.id,
  phone: row.phone,
  status: row.status || "active",
  source: row.source || "website",
  createdAt: row.created_at,
});

/**
 * Normalize a phone number to E.164 (+country code, digits only).
 *
 * Handles the formats the storefront popup is likely to send:
 *   0712345678        → +254712345678   (local Kenyan, leading 0)
 *   712345678         → +254712345678   (local Kenyan, no leading 0)
 *   254712345678      → +254712345678   (international, no +)
 *   +254712345678     → +254712345678   (already E.164)
 *   +1 555 0199       → +15550199       (spaces/dashes/parens stripped)
 *
 * Returns null when the input cannot be interpreted as a valid phone number.
 */
export const normalizePhone = (raw) => {
  if (raw == null) return null;
  let digits = String(raw).replace(/[\s\-().]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) {
    digits = `+${digits.slice(1).replace(/\D/g, "")}`;
  } else if (digits.startsWith("00")) {
    digits = `+${digits.slice(2).replace(/\D/g, "")}`;
  } else if (digits.startsWith("0")) {
    // Local Kenyan number: 0712345678 → +254712345678
    digits = `+254${digits.slice(1)}`;
  } else if (digits.startsWith("254")) {
    digits = `+${digits}`;
  } else if (/^[1-9]\d{8}$/.test(digits)) {
    // 9-digit local number without a leading 0.
    digits = `+254${digits}`;
  } else {
    return null;
  }

  // E.164: + followed by 8–15 digits, no leading 0 after the +.
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
};

/**
 * List subscribers newest-first with server-side pagination and phone search.
 * Returns { subscribers, total, page, pageSize, totalPages }.
 */
export const listSubscribers = async (env, options = {}) => {
  requireDb(env);
  await ensureSchema(env);

  const page = Math.max(1, toInt(options.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(options.pageSize, 10)));
  const search = String(options.search || "").trim();

  const conditions = [];
  const bindings = [];
  if (search) {
    conditions.push("phone LIKE ?");
    bindings.push(`%${search}%`);
  }
  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";

  const [countResult, listResult] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS count FROM subscribers${whereClause}`)
      .bind(...bindings)
      .all(),
    env.DB.prepare(
      `SELECT * FROM subscribers${whereClause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, pageSize, (page - 1) * pageSize)
      .all(),
  ]);

  const total = toInt(countResult.results?.[0]?.count);
  return {
    subscribers: (listResult.results || []).map(mapSubscriberRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

/**
 * Create a subscriber from a raw phone number. Normalizes to E.164, rejects
 * invalid numbers (400) and duplicates (409).
 */
export const createSubscriber = async (env, { phone, source } = {}) => {
  requireDb(env);
  await ensureSchema(env);

  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw apiError("INVALID_PHONE", "Invalid phone number.", 400);
  }
  const cleanSource =
    String(source || "website").trim().slice(0, 50) || "website";

  const existing = await env.DB
    .prepare("SELECT id FROM subscribers WHERE phone = ?")
    .bind(normalized)
    .first();
  if (existing) {
    throw apiError("SUBSCRIBER_EXISTS", "Already subscribed.", 409);
  }

  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  try {
    await env.DB
      .prepare(
        "INSERT INTO subscribers (id, phone, created_at, status, source) VALUES (?, ?, ?, 'active', ?)",
      )
      .bind(id, normalized, createdAt, cleanSource)
      .run();
  } catch (error) {
    // A concurrent request may have inserted the same phone first — only a
    // genuine UNIQUE-constraint failure means "already subscribed". Any
    // other DB error must surface as a 500, not a misleading 409.
    if (isUniqueViolation(error)) {
      throw apiError("SUBSCRIBER_EXISTS", "Already subscribed.", 409);
    }
    throw error;
  }

  return { id, phone: normalized, createdAt, status: "active", source: cleanSource };
};

/**
 * Remove a subscriber. Throws 404 when the id does not exist.
 */
export const deleteSubscriber = async (env, id) => {
  requireDb(env);
  await ensureSchema(env);

  const result = await env.DB
    .prepare("DELETE FROM subscribers WHERE id = ?")
    .bind(id)
    .run();
  if (!result.meta?.changes) {
    throw apiError("SUBSCRIBER_NOT_FOUND", "Subscriber not found.", 404);
  }
  return { id };
};

/**
 * Fetch every subscriber (optionally filtered by search) for CSV export.
 * Capped at 10,000 rows — plenty for a growing VIP list.
 */
export const exportSubscribers = async (env, options = {}) => {
  requireDb(env);
  await ensureSchema(env);

  const search = String(options.search || "").trim();
  const whereClause = search ? " WHERE phone LIKE ?" : "";
  const bindings = search ? [`%${search}%`] : [];

  const result = await env.DB
    .prepare(
      `SELECT id, phone, status, source, created_at FROM subscribers${whereClause} ORDER BY created_at DESC, id DESC LIMIT 10000`,
    )
    .bind(...bindings)
    .all();

  return (result.results || []).map(mapSubscriberRow);
};

/**
 * Render subscribers as a CSV document.
 * Columns: Phone Number, Status, Date Joined, Source.
 */
// Spreadsheet apps treat a leading =, +, -, or @ as a formula. The source
// field is client-controlled, so neutralize those prefixes to prevent CSV
// formula injection when the admin opens the export in Excel/Sheets.
// (Phone numbers are server-normalized E.164 and cannot carry such input.)
const neutralizeCsvFormula = (value) => {
  const text = value == null ? "" : String(value);
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
};

export const buildSubscribersCsv = (subscribers) => {
  const escapeCsv = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = ["Phone Number", "Status", "Date Joined", "Source"];
  const lines = [
    header.join(","),
    ...subscribers.map((subscriber) =>
      [
        subscriber.phone,
        subscriber.status,
        subscriber.createdAt,
        neutralizeCsvFormula(subscriber.source),
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
};

/**
 * Enforce the per-IP, per-hour request cap for the subscription popup.
 * Each call increments the rolling counter for `ip` in the current UTC hour
 * and reports whether the request is still within the limit.
 */
export const checkRateLimit = async (env, ip) => {
  requireDb(env);
  await ensureSchema(env);

  const now = new Date();
  const bucket =
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
  const key = `${ip}|${bucket}`;

  await env.DB
    .prepare(
      "INSERT INTO rate_limits (id, ip, bucket, count) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET count = rate_limits.count + 1",
    )
    .bind(key, ip, bucket)
    .run();

  const row = await env.DB
    .prepare("SELECT count FROM rate_limits WHERE id = ?")
    .bind(key)
    .first();
  const count = toInt(row?.count);

  // First request of a new hour for this IP: sweep buckets from earlier
  // hours so the table cannot grow unboundedly (one row per IP per hour).
  if (count === 1) {
    await env.DB
      .prepare("DELETE FROM rate_limits WHERE bucket < ?")
      .bind(bucket)
      .run();
  }

  return { allowed: count <= RATE_LIMIT_MAX, count };
};
