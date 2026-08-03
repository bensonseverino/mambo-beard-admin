export async function onRequest({ request }) {
  if (request.method === "GET") {
    return Response.json({
      success: true,
      data: { revenueToday: 0, revenueMonth: 0, totalOrders: 0 },
    });
  }

  return new Response("Method not allowed", { status: 405 });
}
