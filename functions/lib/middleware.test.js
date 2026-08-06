import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as middleware } from "../_middleware.js";

const invoke = async (method, path) => {
  const request = new Request(`https://example.com${path}`, { method });
  const next = async () => new Response("next", { status: 200 });
  const response = await middleware({ request, next });
  return { response, passedThrough: response.status === 200 && (await response.text()) === "next" };
};

test("public storefront routes pass through without auth", async () => {
  assert.equal((await invoke("GET", "/api/products")).passedThrough, true);
  assert.equal((await invoke("GET", "/api/products/classic-beard-oil")).passedThrough, true);
  assert.equal((await invoke("GET", "/api/media/products/a/b.webp")).passedThrough, true);
  assert.equal((await invoke("POST", "/api/checkout")).passedThrough, true);
  // The VIP subscription popup posts from the public storefront.
  assert.equal((await invoke("POST", "/api/subscribers")).passedThrough, true);
  assert.equal((await invoke("GET", "/")).passedThrough, true);
});

test("admin routes require a Bearer token", async () => {
  const { response } = await invoke("POST", "/api/products");
  assert.equal(response.status, 401);

  const { response: uploadResponse } = await invoke("POST", "/api/upload");
  assert.equal(uploadResponse.status, 401);

  const { response: ordersResponse } = await invoke("GET", "/api/orders");
  assert.equal(ordersResponse.status, 401);

  // Subscriber admin endpoints stay protected; only the popup POST is public.
  const { response: listResponse } = await invoke("GET", "/api/subscribers");
  assert.equal(listResponse.status, 401);

  const { response: deleteResponse } = await invoke(
    "DELETE",
    "/api/subscribers/sub-123",
  );
  assert.equal(deleteResponse.status, 401);
});

test("admin routes pass through with a Bearer token", async () => {
  const request = new Request("https://example.com/api/orders", {
    headers: { authorization: "Bearer admin-token" },
  });
  const next = async () => new Response("next", { status: 200 });
  const response = await middleware({ request, next });
  assert.equal(response.status, 200);
});
