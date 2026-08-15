// Edge caching helpers for the public storefront API.
//
// Pages Functions responses are not cached by the CDN by default, so the
// public read endpoints (catalog + product detail) are served from
// Cloudflare's Cache API when warm. The cache is per-colocation and
// best-effort: a miss recomputes from D1 and repopulates the cache, and a
// failed write is a performance loss, never a correctness one. Admin product
// writes purge the affected keys so edits propagate quickly.
//
// Everything here is a no-op when the Cache API is unavailable (e.g. local
// dev or the test runner), so callers stay simple.

const CATALOG_TTL_SECONDS = 300; // Edge TTL: 5 minutes
const BROWSER_TTL_SECONDS = 60; // Browser TTL: 1 minute

/** Cache headers for cached responses; the Cache API honors the s-maxage TTL. */
export const buildCacheHeaders = () => ({
  "Cache-Control": `public, s-maxage=${CATALOG_TTL_SECONDS}, max-age=${BROWSER_TTL_SECONDS}`,
});

const catalogUrl = (request) => new URL("/api/products", request.url).toString();

const productUrl = (request, key) =>
  new URL(`/api/products/${encodeURIComponent(key)}`, request.url).toString();

/** Best-effort Cache API read; returns undefined on a miss or when unavailable. */
export const getCachedResponse = async (request) => {
  try {
    return await caches.default.match(request);
  } catch {
    return undefined;
  }
};

/**
 * Best-effort Cache API write. The stored response's Cache-Control header
 * sets its TTL. `request` must be a GET Request (or a URL string).
 */
export const storeCachedResponse = async (request, response) => {
  try {
    await caches.default.put(request, response.clone());
  } catch {
    // Best-effort by design.
  }
};

/**
 * Purge the storefront catalog and a product's detail pages after an admin
 * write. The detail is cached under both the request URL (slug or id) and
 * the canonical product id, so both keys are removed here. Stale entries in
 * other colocations simply expire via their Cache-Control TTL.
 */
export const invalidateProductCache = async (request, { id, slug } = {}) => {
  const urls = new Set([catalogUrl(request)]);
  for (const key of [id, slug]) {
    if (key) urls.add(productUrl(request, key));
  }
  try {
    await Promise.all(
      [...urls].map((url) => caches.default.delete(new Request(url))),
    );
  } catch {
    // Best-effort: stale entries expire via their Cache-Control TTL.
  }
};
