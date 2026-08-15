// Serves product images from R2 at /api/media/<object-key>.
// The upload handler stores objects under paths like
// "products/<slug>/<color>/<type>/<file>.<ext>" and returns
// /api/media/<path> as the public URL.

export async function onRequestGet({ request, env, params }) {
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
  // Uploaded files use unique names and are never replaced, so both the
  // browser and the CDN may hold them for a year without revalidating.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("CDN-Cache-Control", "public, max-age=31536000, immutable");

  // R2 objects expose a strong ETag, so repeat visits can revalidate with a
  // cheap 304 instead of re-downloading the body.
  const etag = object.httpEtag;
  if (etag) {
    headers.set("ETag", etag);
    const ifNoneMatch = request.headers.get("if-none-match") || "";
    const matches = ifNoneMatch
      .split(",")
      .map((value) => value.trim())
      .includes(etag);
    if (matches) {
      return new Response(null, { status: 304, headers });
    }
  }

  return new Response(object.body, { headers });
}
