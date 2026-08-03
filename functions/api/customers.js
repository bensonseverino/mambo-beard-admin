export async function onRequest({ request }) {
  if (request.method === "GET") {
    return Response.json({ success: true, data: [] });
  }

  return new Response("Method not allowed", { status: 405 });
}
