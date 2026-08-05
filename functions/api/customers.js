import { ensureSchema, errorResponse, requireDb } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const db = requireDb(env);
    await ensureSchema(env);

    // Customers are upserted by checkout (find by phone, update or create),
    // so this table is the single source of truth for the Customers tab.
    const result = await db.prepare(
      "SELECT * FROM customers ORDER BY lifetime_spend DESC",
    ).all();

    return Response.json({
      success: true,
      data: (result.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        location: row.location,
        totalOrders: row.total_orders,
        lifetimeSpend: row.lifetime_spend,
        lastOrderAt: row.last_order_at,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
