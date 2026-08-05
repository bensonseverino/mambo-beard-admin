import { updateInventoryStock } from "../../lib/inventory-db.js";
import { errorResponse } from "../../lib/schema.js";

export async function onRequest({ request, params, env }) {
  if (request.method !== "PUT") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const updated = await updateInventoryStock(env, params.id, payload.stock);
    return Response.json({ success: true, data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
