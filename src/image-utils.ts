export type Format = "image/png" | "image/jpeg" | "image/webp";
export const formats: Format[] = ["image/png", "image/jpeg", "image/webp"];
export const extension = (type: Format) =>
  type === "image/jpeg" ? "jpg" : type.split("/")[1];
export const bytes = (n: number) =>
  n < 1024
    ? n + " B"
    : n < 1048576
      ? (n / 1024).toFixed(1) + " KB"
      : (n / 1048576).toFixed(2) + " MB";
export async function decodeImage(file: Blob) {
  if (!formats.includes(file.type as Format))
    throw Error("Unsupported file. Choose a JPG, PNG, or WebP image.");
  if (file.size > 25 * 1048576)
    throw Error("Image exceeds the 25 MB file limit.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw Error("This image is corrupt or cannot be decoded by your browser.");
  }
  if (bitmap.width * bitmap.height > 40_000_000) {
    bitmap.close();
    throw Error("Image exceeds 40 megapixels. Resize it before importing.");
  }
  return bitmap;
}
export async function convertImage(
  file: Blob,
  type: Format,
  quality = 0.9,
  background = "#ffffff",
  maxEdge = Infinity,
) {
  if (!formats.includes(type)) throw Error("Unsupported output format");
  const image = await decodeImage(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height)),
      width = Math.max(1, Math.round(image.width * scale)),
      height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Canvas is unavailable in this browser.");
    if (type === "image/jpeg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Image encoding failed."))),
        type,
        Math.max(0, Math.min(1, quality)),
      ),
    );
    if (blob.type !== type)
      throw Error(
        "Your browser does not support encoding this format. Choose PNG or JPG.",
      );
    return { blob, width, height };
  } finally {
    image.close();
  }
}
export async function solidBackground(file: Blob, color: string) {
  const image = await decodeImage(file);
  try {
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(Error("PNG encoding failed."))),
        "image/png",
      ),
    );
  } finally {
    image.close();
  }
}
