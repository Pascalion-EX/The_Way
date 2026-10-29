import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, link, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UPLOADED_IMAGE_NAME = /^[a-f0-9]{64}\.webp$/;
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const uploadsDirectory = () => resolve(process.env.UPLOADS_DIR ||
  fileURLToPath(new URL("../../uploads/", import.meta.url)));

export const ensureUploadsDirectory = (directory = uploadsDirectory()) => mkdir(directory, { recursive: true, mode: 0o755 });

export class ImageUploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const imageType = (data) => {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
};

export async function saveUploadedImage(data, type, directory = uploadsDirectory()) {
  if (!Buffer.isBuffer(data) || !data.length) throw new ImageUploadError("Choose an image to upload.");
  if (data.length > MAX_IMAGE_BYTES) throw new ImageUploadError("Images must be 5 MB or smaller.", 413);
  if (!IMAGE_TYPES.has(type) || imageType(data) !== type) {
    throw new ImageUploadError("Choose a valid JPEG, PNG, or WebP image.");
  }

  let output;
  try {
    const image = sharp(data, { limitInputPixels: 20_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if ((metadata.pages || 1) > 1) throw new Error("Animated images are not supported");
    // Decode and re-encode rather than publishing client bytes or filenames.
    // This also strips metadata and bounds the stored image dimensions.
    output = await image.rotate().resize({
      width: 2560, height: 2560, fit: "inside", withoutEnlargement: true,
    }).webp({ quality: 85 }).timeout({ seconds: 10 }).toBuffer();
  } catch {
    throw new ImageUploadError("This image could not be read. Choose a still JPEG, PNG, or WebP image up to 20 megapixels.");
  }

  const filename = `${createHash("sha256").update(output).digest("hex")}.webp`;
  await ensureUploadsDirectory(directory);
  const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, output, { flag: "wx", mode: 0o644 });
    // Publish a complete file atomically, including across the two API workers.
    try {
      await link(temporaryPath, join(directory, filename));
    } catch (error) {
      // Identical decoded images share a URL; never overwrite an existing image.
      if (error.code !== "EEXIST") throw error;
    }
  } finally {
    await unlink(temporaryPath).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
  return { url: `/uploads/${filename}`, size: output.length };
}
