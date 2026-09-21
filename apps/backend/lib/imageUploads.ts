import path from "node:path";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const uploadDirectory = () => path.resolve(process.env.UPLOAD_DIRECTORY || path.join(process.cwd(), "storage", "uploads"));

export async function prepareImage(bytes: Buffer, mime: string) {
  if (!IMAGE_TYPES.includes(mime)) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Images must be smaller than 5 MB.");
  const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("Unsupported image content.");
  return image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
}

export function validImageFilename(name: string) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(name);
}
