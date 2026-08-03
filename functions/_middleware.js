export async function onRequest(context) {
  const { request, next } = context;
  const authHeader = request.headers.get("authorization");
  const isAdminRoute = request.url.includes("/api/");

  if (!isAdminRoute) {
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return next();
}
