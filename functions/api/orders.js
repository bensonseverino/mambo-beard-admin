import { listOrders } from "../lib/orders-db.js";
import { errorResponse } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const result = await listOrders(env, {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("pageSize"),
        search: url.searchParams.get("search") || "",
        status: url.searchParams.get("status") || "",
        date: url.searchParams.get("date") || "",
      });
      return Response.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
