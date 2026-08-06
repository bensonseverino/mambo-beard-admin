import test from "node:test";
import assert from "node:assert/strict";
import { createFakeD1 } from "./__tests__/fake-d1.js";
import { ensureSchema } from "./schema.js";
import {
  buildSubscribersCsv,
  checkRateLimit,
  createSubscriber,
  deleteSubscriber,
  exportSubscribers,
  listSubscribers,
  normalizePhone,
  RATE_LIMIT_MAX,
} from "./subscribers-db.js";

const makeEnv = async () => {
  const env = { DB: createFakeD1() };
  await ensureSchema(env);
  return env;
};

// Insert directly so the test controls created_at ordering deterministically.
const insertSubscriber = async (env, phone, createdAt) => {
  await env.DB.prepare(
    "INSERT INTO subscribers (id, phone, created_at, status, source) VALUES (?, ?, ?, 'active', 'website')",
  )
    .bind(`sub-${createdAt}-${phone}`, phone, createdAt)
    .run();
};

test("normalizePhone converts common Kenyan formats to E.164", () => {
  assert.equal(normalizePhone("0712345678"), "+254712345678");
  assert.equal(normalizePhone("712345678"), "+254712345678");
  assert.equal(normalizePhone("254712345678"), "+254712345678");
  assert.equal(normalizePhone("+254712345678"), "+254712345678");
  assert.equal(normalizePhone("0722 345 678"), "+254722345678");
  assert.equal(normalizePhone("+1 555 0199"), "+15550199");
});

test("normalizePhone rejects invalid numbers", () => {
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("+123"), null);
  assert.equal(normalizePhone("0712"), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(undefined), null);
});

test("createSubscriber stores a normalized phone with defaults", async () => {
  const env = await makeEnv();
  const created = await createSubscriber(env, { phone: "0712345678" });

  assert.equal(created.phone, "+254712345678");
  const rows = env.DB._rows("subscribers");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phone, "+254712345678");
  assert.equal(rows[0].status, "active");
  assert.equal(rows[0].source, "website");
});

test("createSubscriber rejects duplicates with 409 and invalid phones with 400", async () => {
  const env = await makeEnv();
  await createSubscriber(env, { phone: "0712345678" });

  await assert.rejects(
    () => createSubscriber(env, { phone: "+254712345678" }),
    (error) => error.code === "SUBSCRIBER_EXISTS" && error.status === 409,
  );

  await assert.rejects(
    () => createSubscriber(env, { phone: "not-a-phone" }),
    (error) => error.code === "INVALID_PHONE" && error.status === 400,
  );
});

test("listSubscribers paginates newest-first and searches by phone", async () => {
  const env = await makeEnv();
  await insertSubscriber(env, "+254700000001", "2026-08-01T10:00:00.000Z");
  await insertSubscriber(env, "+254700000002", "2026-08-02T10:00:00.000Z");
  await insertSubscriber(env, "+254711111111", "2026-08-03T10:00:00.000Z");

  const page1 = await listSubscribers(env, { page: 1, pageSize: 2 });
  assert.equal(page1.total, 3);
  assert.equal(page1.subscribers.length, 2);
  assert.equal(page1.totalPages, 2);
  assert.equal(page1.subscribers[0].phone, "+254711111111");
  assert.equal(page1.subscribers[1].phone, "+254700000002");

  const page2 = await listSubscribers(env, { page: 2, pageSize: 2 });
  assert.equal(page2.subscribers.length, 1);
  assert.equal(page2.subscribers[0].phone, "+254700000001");

  const searched = await listSubscribers(env, { search: "700000" });
  assert.equal(searched.total, 2);
  assert.equal(searched.subscribers.length, 2);
});

test("deleteSubscriber removes a subscriber and 404s on a missing id", async () => {
  const env = await makeEnv();
  await createSubscriber(env, { phone: "0712345678" });
  const id = env.DB._rows("subscribers")[0].id;

  await deleteSubscriber(env, id);
  assert.equal(env.DB._rows("subscribers").length, 0);

  await assert.rejects(
    () => deleteSubscriber(env, id),
    (error) => error.code === "SUBSCRIBER_NOT_FOUND" && error.status === 404,
  );
});

test("exportSubscribers returns all rows, optionally filtered by search", async () => {
  const env = await makeEnv();
  await insertSubscriber(env, "+254700000001", "2026-08-01T10:00:00.000Z");
  await insertSubscriber(env, "+254711111111", "2026-08-02T10:00:00.000Z");

  const all = await exportSubscribers(env);
  assert.equal(all.length, 2);
  assert.deepEqual(
    Object.keys(all[0]).sort(),
    ["createdAt", "id", "phone", "source", "status"],
  );

  const filtered = await exportSubscribers(env, { search: "711111" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].phone, "+254711111111");
});

test("buildSubscribersCsv emits the expected header, rows, and escaping", () => {
  const csv = buildSubscribersCsv([
    {
      phone: "+254712345678",
      status: "active",
      source: "website",
      createdAt: "2026-08-06 10:00:00",
    },
    {
      phone: "+1,555,0199",
      status: "active",
      source: "popup",
      createdAt: "2026-08-05 09:00:00",
    },
  ]);

  assert.match(csv, /^Phone Number,Status,Date Joined,Source\r\n/);
  assert.match(csv, /\+254712345678,active,2026-08-06 10:00:00,website/);
  assert.match(csv, /"\+1,555,0199",active,2026-08-05 09:00:00,popup/);
});

const failInsertWith = (env, error) => {
  const originalPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (/^INSERT INTO subscribers/.test(String(sql).trim())) {
      statement.run = async () => {
        throw error;
      };
    }
    return statement;
  };
};

test("createSubscriber maps UNIQUE-constraint insert failures to 409", async () => {
  const env = await makeEnv();
  const error = new Error("UNIQUE constraint failed: subscribers.phone");
  error.cause = { code: "SQLITE_CONSTRAINT_UNIQUE" };
  failInsertWith(env, error);

  await assert.rejects(
    () => createSubscriber(env, { phone: "0712345678" }),
    (error) => error.code === "SUBSCRIBER_EXISTS" && error.status === 409,
  );
});

test("createSubscriber rethrows non-unique DB errors instead of masking them", async () => {
  const env = await makeEnv();
  const error = new Error("no such column: source");
  error.cause = { code: "SQLITE_ERROR" };
  failInsertWith(env, error);

  await assert.rejects(
    () => createSubscriber(env, { phone: "0712345678" }),
    (error) => error.message === "no such column: source",
  );
});

test("buildSubscribersCsv neutralizes formula-leading source values", () => {
  const csv = buildSubscribersCsv([
    {
      phone: "+254712345678",
      status: "active",
      source: '=HYPERLINK("http://evil.example")',
      createdAt: "2026-08-06 10:00:00",
    },
  ]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /\+254712345678,active,/);
});

test("checkRateLimit sweeps stale buckets on the first request of an hour", async () => {
  const env = await makeEnv();
  const now = new Date();
  const oldBucket = `${now.getUTCFullYear()}-01-01-00`;
  await env.DB
    .prepare(
      "INSERT INTO rate_limits (id, ip, bucket, count) VALUES (?, ?, ?, 1)",
    )
    .bind(`stale|${oldBucket}`, "stale-ip", oldBucket)
    .run();

  // First request for this IP in the current bucket triggers the sweep.
  const result = await checkRateLimit(env, "192.0.2.1");
  assert.equal(result.allowed, true);
  assert.equal(result.count, 1);
  const rows = env.DB._rows("rate_limits");
  assert.ok(!rows.some((row) => row.bucket === oldBucket));
});

test("checkRateLimit blocks the 6th request per IP per hour", async () => {
  const env = await makeEnv();
  for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
    const result = await checkRateLimit(env, "192.0.2.1");
    assert.equal(result.allowed, true);
    assert.equal(result.count, i + 1);
  }

  const blocked = await checkRateLimit(env, "192.0.2.1");
  assert.equal(blocked.allowed, false);

  // Other IPs are unaffected.
  const other = await checkRateLimit(env, "192.0.2.2");
  assert.equal(other.allowed, true);
  assert.equal(other.count, 1);
});
