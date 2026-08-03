export async function onRequest({ request, params, env }) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const objectPath = params.path || "";
  if (!objectPath || !env?.PRODUCTS) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const object = await env.PRODUCTS.get(objectPath);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    const contentType =
      object.httpMetadata?.contentType || "application/octet-stream";
    headers.set("content-type", contentType);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
