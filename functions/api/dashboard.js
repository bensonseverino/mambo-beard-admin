import { ensureSchema, errorResponse, requireDb } from "../lib/schema.js";

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const db = requireDb(env);
    await ensureSchema(env);

    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = `${today.slice(0, 7)}-01`;

    const [allResult, todayResult, monthResult, lowStockResult] =
      await Promise.all([
        db.prepare(
          "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM orders",
        ).all(),
        db.prepare(
          "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE created_at >= ?",
        ).bind(today).all(),
        db.prepare(
          "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE created_at >= ?",
        ).bind(firstOfMonth).all(),
        db.prepare(
          "SELECT COUNT(*) AS count FROM inventory WHERE stock <= 2",
        ).all(),
      ]);

    return Response.json({
      success: true,
      data: {
        revenueToday: toInt(todayResult.results?.[0]?.revenue),
        revenueMonth: toInt(monthResult.results?.[0]?.revenue),
        totalOrders: toInt(allResult.results?.[0]?.count),
        lowStockCount: toInt(lowStockResult.results?.[0]?.count),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
