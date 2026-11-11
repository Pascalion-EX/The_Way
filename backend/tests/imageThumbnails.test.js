import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import express from "express";
import sharp from "sharp";
import { createUploadRouter, createUploadedImagesRouter } from "../routes/uploadRoutes.js";
import { saveUploadedImage } from "../services/imageUploads.js";
import { MAX_THUMBNAIL_BYTES, THUMBNAIL_DIMENSION } from "../services/imageThumbnails.js";

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), "the-way-thumbnail-test-"));
  const servers = [];
  t.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
    await rm(directory, { recursive: true, force: true });
  });
  const urls = [];
  for (let worker = 0; worker < 2; worker++) {
    const app = express();
    app.use("/api/uploads", createUploadRouter({ directory }));
    app.use("/uploads", createUploadedImagesRouter({ directory }));
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await once(server, "listening");
    urls.push(`http://127.0.0.1:${server.address().port}`);
  }
  return {
    directory, urls,
    request: (filename, worker = 0, options) => fetch(`${urls[worker]}/api/uploads/thumbnails/v1/${filename}`, options),
  };
}

const noise = async (width, height) => {
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 123456789;
  for (let i = 0; i < pixels.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    pixels[i] = seed & 255;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).webp({ quality: 85 }).toBuffer();
};

test("existing uploads get small public thumbnails while the original image stays intact", async (t) => {
  const state = await setup(t);
  const saved = await saveUploadedImage(await noise(1600, 900), "image/webp", state.directory);
  const filename = basename(saved.url);
  const original = await readFile(join(state.directory, filename));
  const response = await state.request(filename);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control"), /public.*max-age=31536000.*immutable/);
  const preview = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(preview).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width <= THUMBNAIL_DIMENSION && metadata.height <= THUMBNAIL_DIMENSION);
  assert.ok(Math.abs(metadata.width / metadata.height - 1600 / 900) < 0.01);
  assert.ok(preview.length <= MAX_THUMBNAIL_BYTES);
  assert.ok(preview.length < original.length / 4, "card images should transfer substantially fewer bytes");
  const full = await fetch(state.urls[1] + saved.url);
  assert.equal(full.status, 200);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), original);
  assert.deepEqual(await readFile(join(state.directory, filename)), original);
  t.diagnostic(`Synthetic detailed image: ${original.length} bytes original -> ${preview.length} bytes thumbnail`);
});

test("detailed thumbnails meet the byte budget and small images are never enlarged", async (t) => {
  const state = await setup(t);
  const source = await noise(480, 480);
  const unbounded = await sharp(source).webp({ quality: 60 }).toBuffer();
  assert.ok(unbounded.length > MAX_THUMBNAIL_BYTES, "exercise the byte-budget resize retry");
  const filename = `${"b".repeat(64)}.webp`;
  await writeFile(join(state.directory, filename), source);
  const response = await state.request(filename);
  assert.equal(response.status, 200);
  const preview = Buffer.from(await response.arrayBuffer());
  assert.ok(preview.length <= MAX_THUMBNAIL_BYTES);
  assert.ok((await sharp(preview).metadata()).width < 480);

  const small = await sharp({ create: { width: 24, height: 40, channels: 3, background: "white" } }).webp().toBuffer();
  const saved = await saveUploadedImage(small, "image/webp", state.directory);
  const metadata = await sharp(Buffer.from(await (await state.request(basename(saved.url))).arrayBuffer())).metadata();
  assert.equal(metadata.width, 24);
  assert.equal(metadata.height, 40);
});

test("concurrent requests share an atomic disk cache across API routers and support HEAD and revalidation", async (t) => {
  const state = await setup(t);
  const saved = await saveUploadedImage(await noise(800, 600), "image/webp", state.directory);
  const filename = basename(saved.url);
  const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => state.request(filename, index % 2)));
  assert.ok(responses.every((response) => response.status === 200));
  const previews = await Promise.all(responses.map(async (response) => Buffer.from(await response.arrayBuffer())));
  assert.ok(previews.every((preview) => preview.equals(previews[0])));
  const cache = join(state.directory, ".thumbnails", "v1");
  assert.deepEqual(await readdir(cache), [filename]);
  const cached = await stat(join(cache, filename));
  assert.equal(cached.mode & 0o777, 0o644);

  const head = await state.request(filename, 1, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get("content-length")), previews[0].length);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const unchanged = await state.request(filename, 0, {
    headers: { "If-None-Match": head.headers.get("etag"), "Cache-Control": "max-age=0" },
  });
  assert.equal(unchanged.status, 304);
  assert.equal((await stat(join(cache, filename))).mtimeMs, cached.mtimeMs);
});

test("invalid and missing paths return uncached errors without exposing storage details, and failures can recover", async (t) => {
  const state = await setup(t);
  for (const filename of ["missing.webp", ".env", "../package.json", `${"c".repeat(64)}.webp`, "%2e%2e%2fpackage.json"]) {
    const response = await state.request(filename);
    assert.equal(response.status, 404, filename);
    assert.doesNotMatch(await response.text(), /the-way-thumbnail-test|ENOENT/);
    assert.doesNotMatch(response.headers.get("cache-control") || "", /immutable/);
  }
  const filename = `${"c".repeat(64)}.webp`;
  await writeFile(join(state.directory, filename), "broken image");
  const broken = await state.request(filename);
  assert.equal(broken.status, 503);
  assert.equal(broken.headers.get("cache-control"), "no-store");
  assert.equal(await broken.text(), "");
  await writeFile(join(state.directory, filename), await noise(100, 80));
  assert.equal((await state.request(filename)).status, 200, "a failed generation must not poison the queue or cache");
  const unsupported = await state.request(filename, 0, { method: "POST" });
  assert.equal(unsupported.status, 404);
});
