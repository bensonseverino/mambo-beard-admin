// Serves product images from R2 at /api/media/<object-key>.
// The upload handler stores objects under paths like
// "products/<slug>/<color>/<type>/<file>.<ext>" and returns
// /api/media/<path> as the public URL.

export async function onRequestGet({ env, params }) {
  const raw = Array.isArray(params.path)
    ? params.path.join("/")
    : String(params.path || "");
  const key = raw ? decodeURIComponent(raw) : "";

  if (!key) {
    return Response.json({ success: false, error: "Missing object path" }, { status: 400 });
  }

  if (!env?.PRODUCTS) {
    return Response.json(
      { success: false, error: "R2 bucket binding PRODUCTS is not configured" },
      { status: 500 },
    );
  }

  const object = await env.PRODUCTS.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream",
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
