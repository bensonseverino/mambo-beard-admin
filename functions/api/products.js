export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    return Response.json({ success: true, data: [] });
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => ({}));
    return Response.json({ success: true, data: payload });
  }

  return new Response("Method not allowed", { status: 405 });
}
