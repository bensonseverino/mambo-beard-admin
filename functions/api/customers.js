import { listCustomers } from "../lib/customers-db.js";
import { errorResponse } from "../lib/schema.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const result = await listCustomers(env, {
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize"),
      search: url.searchParams.get("search") || "",
    });
    return Response.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
