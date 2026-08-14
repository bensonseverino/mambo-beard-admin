// GET /api/sizes — the size catalog used by the admin product form.
//
// The admin renders the size checkboxes from this endpoint, so adding a new
// size to the `sizes` table (e.g. XS, XXXL, 4XL) makes it available in the
// dashboard without any code changes. Bearer-protected by _middleware.js.

import { errorResponse, ensureSchema, requireDb } from "../lib/schema.js";

const STANDARD_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
const sizeRank = (name) => {
  const index = STANDARD_SIZE_ORDER.indexOf(String(name || "").trim());
  return index === -1 ? STANDARD_SIZE_ORDER.length : index;
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  try {
    const db = requireDb(env);
    await ensureSchema(env);
    const result = await db.prepare("SELECT id, name FROM sizes").all();
    const sizes = (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
    }));
    sizes.sort((a, b) => sizeRank(a.name) - sizeRank(b.name));
    return Response.json({ success: true, data: sizes });
  } catch (error) {
    return errorResponse(error);
  }
}
