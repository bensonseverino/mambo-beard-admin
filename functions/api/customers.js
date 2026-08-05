import { ensureSchema, errorResponse, requireDb } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const db = requireDb(env);
    await ensureSchema(env);

    const result = await db.prepare(
      "SELECT customer_name, phone, email, total, created_at FROM orders ORDER BY created_at DESC",
    ).all();

    const customers = new Map();
    for (const row of result.results || []) {
      const key = row.phone || row.customer_name || "unknown";
      const existing = customers.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.lifetimeSpend += Number(row.total) || 0;
      } else {
        customers.set(key, {
          id: `cus-${key.replace(/[^a-z0-9]/gi, "").slice(0, 16)}`,
          name: row.customer_name,
          phone: row.phone,
          email: row.email,
          totalOrders: 1,
          lifetimeSpend: Number(row.total) || 0,
        });
      }
    }

    return Response.json({
      success: true,
      data: [...customers.values()].sort(
        (a, b) => b.lifetimeSpend - a.lifetimeSpend,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
