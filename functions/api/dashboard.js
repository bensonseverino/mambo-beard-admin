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

    const [
      todayOrdersResult,
      todayRevenueResult,
      totalCustomersResult,
      pendingOrdersResult,
      lowStockResult,
      recentOrdersResult,
      productsResult,
      colorsResult,
      sizesResult,
    ] = await Promise.all([
      db.prepare(
        "SELECT COUNT(*) AS count FROM orders WHERE created_at >= ?",
      )
        .bind(today)
        .first(),
      db.prepare(
        "SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE created_at >= ?",
      )
        .bind(today)
        .first(),
      db.prepare("SELECT COUNT(*) AS count FROM customers").first(),
      db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status = ?")
        .bind("pending")
        .first(),
      db.prepare(
        "SELECT * FROM inventory WHERE stock <= ? ORDER BY stock ASC LIMIT 20",
      )
        .bind(2)
        .all(),
      db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8").all(),
      db.prepare("SELECT id, name, active FROM products").all(),
      db.prepare("SELECT id, name, hex FROM product_colors").all(),
      db.prepare("SELECT id, name FROM sizes").all(),
    ]);

    const productNames = new Map(
      (productsResult.results || []).map((row) => [row.id, row.name]),
    );
    const activeProductIds = new Set(
      (productsResult.results || [])
        .filter((row) => row.active)
        .map((row) => row.id),
    );
    const colorInfos = new Map(
      (colorsResult.results || []).map((row) => [row.id, row]),
    );
    const sizeNames = new Map(
      (sizesResult.results || []).map((row) => [row.id, row.name]),
    );

    const lowStockProducts = (lowStockResult.results || [])
      .filter((row) => activeProductIds.has(row.product_id))
      .map((row) => ({
        inventoryId: row.id,
        productId: row.product_id,
        productName: productNames.get(row.product_id) || "Unknown product",
        colorId: row.color_id,
        colorName: colorInfos.get(row.color_id)?.name || "",
        colorHex: colorInfos.get(row.color_id)?.hex || "",
        sizeId: row.size_id,
        size: sizeNames.get(row.size_id) || row.size_id,
        stock: toInt(row.stock),
      }));

    const recentOrders = (recentOrdersResult.results || []).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      phone: row.phone,
      status: row.status,
      total: toInt(row.total),
      createdAt: row.created_at,
    }));

    return Response.json({
      success: true,
      data: {
        todayOrders: toInt(todayOrdersResult?.count),
        todayRevenue: toInt(todayRevenueResult?.revenue),
        totalCustomers: toInt(totalCustomersResult?.count),
        pendingOrders: toInt(pendingOrdersResult?.count),
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
        recentOrders,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
