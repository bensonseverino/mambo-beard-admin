// GET /api/size-charts — the reference library of product size charts.
//
// Charts live in src/size-charts.js (shared with the admin preview) so adding
// or editing a chart needs no database changes. Bearer-protected by
// _middleware.js like the rest of the admin surface; point the storefront at
// this endpoint when it renders the chart assigned to a product.

import { listPublicSizeCharts } from "../../src/size-charts.js";

export async function onRequest({ request }) {
  if (request.method !== "GET") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  return Response.json({
    success: true,
    data: listPublicSizeCharts(),
  });
}
