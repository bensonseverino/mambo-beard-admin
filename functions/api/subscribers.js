import {
  buildSubscribersCsv,
  checkRateLimit,
  createSubscriber,
  exportSubscribers,
  listSubscribers,
} from "../lib/subscribers-db.js";

const renderError = (error) => {
  const status = error?.status || 500;
  if (status >= 500) {
    console.error("[subscribers]", error?.message || error);
  }
  const message =
    status >= 500 ? "Server error." : error?.message || "Request failed.";
  return Response.json({ success: false, message }, { status });
};

const clientIp = (request) =>
  request.headers.get("CF-Connecting-IP") ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

export async function onRequest({ request, env }) {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);

      // Admin CSV export (auth enforced by the middleware).
      if (url.searchParams.get("export") === "csv") {
        const subscribers = await exportSubscribers(env, {
          search: url.searchParams.get("search") || "",
        });
        const csv = buildSubscribersCsv(subscribers);
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="subscribers.csv"',
          },
        });
      }

      const result = await listSubscribers(env, {
        page: url.searchParams.get("page"),
        pageSize: url.searchParams.get("pageSize"),
        search: url.searchParams.get("search") || "",
      });
      return Response.json({ success: true, data: result });
    }

    if (request.method === "POST") {
      // The storefront popup is public, so the per-IP cap is the only
      // protection against spam: 5 requests per IP per hour.
      const ip = clientIp(request);
      const rate = await checkRateLimit(env, ip);
      if (!rate.allowed) {
        return Response.json(
          {
            success: false,
            message: "Rate limit exceeded. Please try again later.",
          },
          { status: 429 },
        );
      }

      const payload = await request.json().catch(() => ({}));
      const created = await createSubscriber(env, {
        phone: payload.phone,
        source: payload.source,
      });
      return Response.json({ success: true, data: created }, { status: 201 });
    }

    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  } catch (error) {
    return renderError(error);
  }
}
