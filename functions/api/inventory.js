import { listInventory } from "../lib/inventory-db.js";
import { errorResponse } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await listInventory(env);
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
