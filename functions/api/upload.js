const acceptedImageTypes = ["image/webp", "image/jpeg", "image/png"];
const maxImageSizeBytes = 20 * 1024 * 1024;

const sanitizeSegment = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "product";

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

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

  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const path = `products/${productSlug}/${colorName}/${imageType}/${uniqueName}`;

  return Response.json({
    success: true,
    path,
    name: uniqueName,
    size: arrayBuffer.byteLength,
  });
}
