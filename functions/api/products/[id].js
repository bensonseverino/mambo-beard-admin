import {
  buildCacheHeaders,
  getCachedResponse,
  invalidateProductCache,
  storeCachedResponse,
} from "../../lib/cache.js";
import {
  deleteProduct,
  getProductDetail,
  updateProduct,
} from "../../lib/products-db.js";
import { apiError, errorResponse } from "../../lib/schema.js";

export async function onRequest({ request, params, env }) {
  try {
    if (request.method === "GET") {
      // Storefront product pages are public and read-mostly; serve warm
      // responses from the Cloudflare edge cache.
      const cached = await getCachedResponse(request);
      if (cached) return cached;

      const detail = await getProductDetail(env, params.id);
      if (!detail) {
        return errorResponse(
          apiError("PRODUCT_NOT_FOUND", "Product not found.", 404),
        );
      }

      const response = Response.json(
        { success: true, data: detail },
        { headers: buildCacheHeaders() },
      );
      await storeCachedResponse(request, response);
      // Also cache under the canonical product id so admin edits purge this
      // page even when the storefront fetched it by slug.
      if (detail.product?.id) {
        await storeCachedResponse(
          new Request(new URL(`/api/products/${detail.product.id}`, request.url)),
          response,
        );
      }
      return response;
    }

    if (request.method === "PUT") {
      const payload = await request.json().catch(() => ({}));
      const updatedProduct = await updateProduct(env, params.id, payload);
      await invalidateProductCache(request, {
        id: params.id,
        slug: updatedProduct?.slug,
      });
      return Response.json({
        success: true,
        id: params.id,
        data: updatedProduct,
      });
    }

    if (request.method === "DELETE") {
      await deleteProduct(env, params.id);
      await invalidateProductCache(request, { id: params.id });
      return Response.json({ success: true, id: params.id, deleted: true });
    }
  } catch (error) {
    return errorResponse(error);
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
