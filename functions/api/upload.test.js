import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { onRequestPost } from "./upload.js";

// Minimal WebP-shaped buffer builder (see lib/images.test.js).
const makeWebp = (chunks) => {
  const parts = [];
  let total = 12;
  for (const [fourcc, payload] of chunks) {
    const header = Buffer.alloc(8);
    header.write(fourcc, 0, "ascii");
    header.writeUInt32LE(payload.length, 4);
    const pad = payload.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
    parts.push(header, payload, pad);
    total += 8 + payload.length + pad.length;
  }
  const out = Buffer.alloc(total);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(total - 8, 4);
  out.write("WEBP", 8, "ascii");
  let pos = 12;
  for (const part of parts) {
    part.copy(out, pos);
    pos += part.length;
  }
  return out;
};

const makeRequest = async (bytes, type = "image/webp") => {
  const form = new FormData();
  form.append("file", new File([bytes], "photo.webp", { type }));
  form.append("productSlug", "test-product");
  form.append("colorName", "black");
  form.append("imageType", "front");
  return new Request("https://example.com/api/upload", {
    method: "POST",
    headers: { Authorization: "Bearer test-token" },
    body: form,
  });
};

const makeContext = () => {
  const puts = [];
  return {
    request: null,
    env: {
      PRODUCTS: {
        put: async (path, body, opts) => {
          puts.push({ path, body, opts });
        },
      },
    },
    puts,
  };
};

test("animated-flagged WebP upload is accepted and stored in R2", async () => {
  const animated = makeWebp([
    ["VP8X", Buffer.from([0x10])],
    ["VP8 ", Buffer.alloc(10)],
  ]);
  const ctx = makeContext();
  ctx.request = await makeRequest(animated);
  const res = await onRequestPost(ctx);
  assert.equal(res.status, 200);
  assert.equal(ctx.puts.length, 1);
  const payload = await res.json();
  assert.equal(payload.success, true);
});

test("clean static WebP upload succeeds and stores bytes in R2", async () => {
  const clean = makeWebp([["VP8 ", Buffer.alloc(10)]]);
  const ctx = makeContext();
  ctx.request = await makeRequest(clean);
  const res = await onRequestPost(ctx);
  assert.equal(res.status, 200);
  assert.equal(ctx.puts.length, 1);
  assert.match(ctx.puts[0].path, /^products\/test-product\/black\/front\/.+\.webp$/);
  assert.equal(ctx.puts[0].opts.httpMetadata.contentType, "image/webp");
  assert.equal(ctx.puts[0].body.byteLength, clean.length);
  const payload = await res.json();
  assert.equal(payload.success, true);
});
