import { deleteSubscriber } from "../../lib/subscribers-db.js";

// Same error contract as the collection route: spec-exact "Server error."
// for 500s so every /api/subscribers* response is consistent.
const renderError = (error) => {
  const status = error?.status || 500;
  if (status >= 500) {
    console.error("[subscribers]", error?.message || error);
  }
  const message =
    status >= 500 ? "Server error." : error?.message || "Request failed.";
  return Response.json({ success: false, message }, { status });
};

export async function onRequest({ request, params, env }) {
  if (request.method !== "DELETE") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const result = await deleteSubscriber(env, params.id);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return renderError(error);
  }
}
