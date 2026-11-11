import { randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { UPLOADED_IMAGE_NAME, uploadsDirectory } from "./imageUploads.js";

export const THUMBNAIL_DIMENSION = 480;
export const MAX_THUMBNAIL_BYTES = 40 * 1024;

const pending = new Map();
let processing = Promise.resolve();

async function createThumbnail(source, target, directory) {
  // Only one image is decoded at a time per API worker during a cold-cache burst.
  const image = sharp(source, { limitInputPixels: 20_000_000, failOn: "warning" });
  const deadline = performance.now() + 5000;
  let dimension = THUMBNAIL_DIMENSION;
  let output;
  while (true) {
    const seconds = Math.ceil((deadline - performance.now()) / 1000);
    if (seconds <= 0) throw new Error("Thumbnail processing timed out");
    const result = await image.clone().rotate().resize({
      width: dimension, height: dimension, fit: "inside", withoutEnlargement: true,
    }).webp({ quality: 60 }).timeout({ seconds }).toBuffer({ resolveWithObject: true });
    output = result.data;
    if (output.length <= MAX_THUMBNAIL_BYTES) break;
    const scale = Math.min(0.9, Math.sqrt(MAX_THUMBNAIL_BYTES / output.length) * 0.9);
    dimension = Math.max(1, Math.floor(Math.max(result.info.width, result.info.height) * scale));
  }

  await mkdir(directory, { recursive: true, mode: 0o755 });
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, output, { flag: "wx", mode: 0o644 });
    try {
      // Both API replicas share this cache; publish complete files atomically.
      await link(temporary, target);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

export async function imageThumbnailPath(filename, directory = uploadsDirectory()) {
  if (!UPLOADED_IMAGE_NAME.test(filename)) {
    throw Object.assign(new Error("Image not found"), { code: "ENOENT" });
  }
  // Version the cache and public URL whenever the encoding settings change.
  // Hidden derived files stay out of image backups and regenerate after restore.
  const cache = join(directory, ".thumbnails", "v1");
  const target = join(cache, filename);
  try {
    await access(target);
    return target;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const source = join(directory, filename);
  await access(source);
  if (!pending.has(target)) {
    const task = processing.then(() => createThumbnail(source, target, cache));
    processing = task.catch(() => {});
    pending.set(target, task);
    task.finally(() => pending.delete(target)).catch(() => {});
  }
  await pending.get(target);
  return target;
}
