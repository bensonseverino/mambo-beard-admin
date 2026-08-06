// Route-level auth scoping.
//
// The storefront (public) needs unauthenticated access to:
//   GET  /api/products*            — catalog + product detail
//   GET  /api/media*               — product images
//   POST /api/checkout             — place an order
//
// Every other /api/* route is admin-only and requires a Bearer token.
// The admin dashboard always sends `Authorization: Bearer <token>`.

const PUBLIC_ROUTES = [
  { prefix: "/api/products", method: "GET" },
  { prefix: "/api/media", method: "GET" },
  { prefix: "/api/checkout", method: "POST" },
  // The VIP subscription popup posts phone numbers from the storefront.
  // Admin list/export/delete stay Bearer-protected.
  { prefix: "/api/subscribers", method: "POST" },
];

const isPublic = (pathname, method) =>
  PUBLIC_ROUTES.some(
    (route) =>
      route.method === method &&
      (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)),
  );

export async function onRequest(context) {
  const { request, next } = context;
  const { pathname } = new URL(request.url);
  const isApiRoute = pathname.startsWith("/api/");

  if (!isApiRoute || isPublic(pathname, request.method)) {
    return next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return next();
}
