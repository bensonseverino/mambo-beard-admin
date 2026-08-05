import { createProduct, listProducts } from "../lib/products-db.js";

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const products = await listProducts(env, {
      includeInactive: url.searchParams.get("includeInactive") === "1",
    });
    return Response.json({ success: true, data: products });
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    const createdProduct = await createProduct(env, payload);
    return Response.json({ success: true, data: createdProduct });
  }

  return new Response("Method not allowed", { status: 405 });
}
