import { getCustomerDetail } from "../../lib/customers-db.js";
import { errorResponse } from "../../lib/schema.js";

export async function onRequest({ request, params, env }) {
  if (request.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await getCustomerDetail(env, params.id);
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
