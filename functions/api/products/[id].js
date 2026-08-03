export async function onRequest({ request, params }) {
  if (request.method === "PUT") {
    const payload = await request.json().catch(() => ({}));
    return Response.json({ success: true, id: params.id, data: payload });
  }

  if (request.method === "DELETE") {
    return Response.json({ success: true, id: params.id, deleted: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
