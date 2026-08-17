// Shared image helpers for the upload pipeline.
//
// Google Merchant Center rejects animated images with "Invalid image
// encoding [image_link]". Several design tools (Photoshop / Illustrator WebP
// export, some converters) write single-frame images wrapped in a VP8X
// container with the ANIMATION flag set — the file looks fine in a browser
// but Google refuses it. The upload pipeline uses isAnimatedWebp() to reject
// such files up front so they never reach R2.

const decoder = new TextDecoder("ascii");

const ascii = (bytes, start, end) => decoder.decode(bytes.subarray(start, end));

/**
 * True when a WebP buffer is animated — either a VP8X container with the
 * ANIMATION flag set (bit 0x10), or an explicit ANIM/ANMF chunk. Returns
 * false for anything that is not a WebP file.
 *
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export const isAnimatedWebp = (bytes) => {
  if (!bytes || bytes.byteLength < 12) return false;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  while (pos + 8 <= bytes.byteLength) {
    const fourcc = ascii(bytes, pos, pos + 4);
    if (fourcc === "VP8X") {
      // The first payload byte is the flags byte; bit 0x10 = ANIMATION.
      if ((bytes[pos + 8] & 0x10) !== 0) return true;
    } else if (fourcc === "ANIM" || fourcc === "ANMF") {
      return true;
    }
    const size = view.getUint32(pos + 4, true);
    pos += 8 + size + (size % 2);
  }
  return false;
};
