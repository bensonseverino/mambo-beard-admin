import { listOrders } from "../lib/orders-db.js";
import { errorResponse } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    try {
      const orders = await listOrders(env);
      return Response.json({ success: true, data: orders });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
