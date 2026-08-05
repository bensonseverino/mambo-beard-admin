import { updateOrderStatus } from "../../lib/orders-db.js";
import { errorResponse } from "../../lib/schema.js";

export async function onRequest({ request, params, env }) {
  if (request.method === "PUT") {
    try {
      const payload = await request.json().catch(() => ({}));
      const updated = await updateOrderStatus(env, params.id, payload);
      return Response.json({ success: true, id: updated.id, data: updated });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
