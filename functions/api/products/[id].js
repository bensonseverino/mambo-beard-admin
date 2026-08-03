import { deleteProduct, updateProduct } from "../../lib/products-db.js";

export async function onRequest({ request, params, env }) {
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

  return new Response("Method not allowed", { status: 405 });
}
