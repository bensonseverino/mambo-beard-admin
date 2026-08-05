import { createOrder } from "../lib/orders-db.js";
import { errorResponse } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await request.json().catch(() => null);
    if (!payload) {
      return Response.json(
        { success: false, message: "Invalid JSON body.", code: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    const order = await createOrder(env, payload);
    return Response.json(
      { success: true, orderId: order.orderId, orderNumber: order.orderNumber },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
