import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { isAnimatedWebp } from "./images.js";

// Build a minimal WebP-shaped buffer from (fourcc, payload) pairs. The
// payload of a VP8X chunk is its 1-byte flags value (zero-padded to keep
// the builder uniform).
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

const vp8x = (flags) => makeWebp([["VP8X", Buffer.from([flags])]]);

test("VP8X with ANIMATION flag set is detected as animated", () => {
  assert.equal(isAnimatedWebp(vp8x(0x10)), true);
  assert.equal(isAnimatedWebp(vp8x(0x30)), true); // anim + reserved bit
});

test("VP8X without the animation flag is not animated (alpha-only ok)", () => {
  assert.equal(isAnimatedWebp(vp8x(0x02)), false); // alpha only
  assert.equal(isAnimatedWebp(vp8x(0x00)), false);
});

test("explicit ANIM chunk is detected as animated", () => {
  const buf = makeWebp([
    ["VP8X", Buffer.from([0x00])],
    ["ANIM", Buffer.alloc(6)],
    ["VP8 ", Buffer.alloc(10)],
  ]);
  assert.equal(isAnimatedWebp(buf), true);
});

test("plain static WebP (no VP8X) is not animated", () => {
  const buf = makeWebp([["VP8 ", Buffer.alloc(10)]]);
  assert.equal(isAnimatedWebp(buf), false);
});

test("non-WebP and empty buffers are not animated", () => {
  assert.equal(isAnimatedWebp(Buffer.from("RIFFxxxxAVI ")), false);
  assert.equal(isAnimatedWebp(Buffer.alloc(0)), false);
  assert.equal(isAnimatedWebp(null), false);
});
