import {
  deleteProduct,
  getProductDetail,
  updateProduct,
} from "../../lib/products-db.js";
import { apiError, errorResponse } from "../../lib/schema.js";

export async function onRequest({ request, params, env }) {
  try {
    if (request.method === "GET") {
      const detail = await getProductDetail(env, params.id);
      if (!detail) {
        return errorResponse(
          apiError("PRODUCT_NOT_FOUND", "Product not found.", 404),
        );
      }
      return Response.json({ success: true, data: detail });
    }

    if (request.method === "PUT") {
      const payload = await request.json().catch(() => ({}));
      const updatedProduct = await updateProduct(env, params.id, payload);
      return Response.json({
        success: true,
        id: params.id,
        data: updatedProduct,
      });
    }

    if (request.method === "DELETE") {
      await deleteProduct(env, params.id);
      return Response.json({ success: true, id: params.id, deleted: true });
    }
  } catch (error) {
    return errorResponse(error);
  }

  return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
