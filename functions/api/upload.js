const acceptedImageTypes = ["image/webp", "image/jpeg", "image/png", "image/gif", "image/avif", "image/tiff", "image/bmp"];
const maxImageSizeBytes = 20 * 1024 * 1024;

const sanitizeSegment = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "product";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return Response.json(
        { success: false, error: "Invalid upload payload" },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json(
        { success: false, error: "Missing file upload" },
        { status: 400 },
      );
    }

    const productSlug = sanitizeSegment(formData.get("productSlug") || "product");
    const colorName = sanitizeSegment(formData.get("colorName") || "color");
    const imageType = sanitizeSegment(formData.get("imageType") || "gallery");
    // Simple products upload a single color-less gallery:
    // products/<slug>/gallery/<type>/<file>. Variant products keep the
    // per-color layout: products/<slug>/<color>/<type>/<file>.
    const isGallery = formData.get("gallery") === "1";

    const mimeType = file.type || "";
    if (!acceptedImageTypes.includes(mimeType)) {
      return Response.json(
        { success: false, error: "Unsupported file type" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    if (arrayBuffer.byteLength > maxImageSizeBytes) {
      return Response.json(
        { success: false, error: "File exceeds 20 MB limit" },
        { status: 400 },
      );
    }

    const extensionMap = {
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
      "image/tiff": "tiff",
      "image/bmp": "bmp",
    };
    const extension = extensionMap[mimeType] || "jpg";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const path = isGallery
      ? `products/${productSlug}/gallery/${imageType}/${uniqueName}`
      : `products/${productSlug}/${colorName}/${imageType}/${uniqueName}`;

    if (!env?.PRODUCTS) {
      return Response.json(
        { success: false, error: "R2 bucket binding PRODUCTS is not configured" },
        { status: 500 },
      );
    }

    await env.PRODUCTS.put(path, arrayBuffer, {
      httpMetadata: { contentType: mimeType },
    });

    return Response.json({
      success: true,
      imageUrl: `/api/media/${path}`,
      imagePath: path,
      path,
      name: uniqueName,
      size: arrayBuffer.byteLength,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}
