import {
  buildCacheHeaders,
  getCachedResponse,
  invalidateProductCache,
  storeCachedResponse,
} from "../lib/cache.js";
import { createProduct, listProducts } from "../lib/products-db.js";

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";

    // The storefront catalog is public and read-mostly, so warm responses
    // come straight from the Cloudflare edge cache. Admin requests
    // (includeInactive) always read fresh from D1.
    if (!includeInactive) {
      const cached = await getCachedResponse(request);
      if (cached) return cached;
    }

    const products = await listProducts(env, { includeInactive });
    const response = Response.json(
      { success: true, data: products },
      { headers: includeInactive ? undefined : buildCacheHeaders() },
    );
    if (!includeInactive) {
      await storeCachedResponse(request, response);
    }
    return response;
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const createdProduct = await createProduct(env, payload);
    // New products change the catalog, so drop any cached storefront list.
    await invalidateProductCache(request, {
      id: createdProduct.id,
      slug: createdProduct.slug,
    });
    return Response.json({ success: true, data: createdProduct });
  }

  return new Response("Method not allowed", { status: 405 });
}
