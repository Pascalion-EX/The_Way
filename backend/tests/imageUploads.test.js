import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import sharp from "sharp";
import User from "../models/userModel.js";
import Counters from "../models/authRateLimitModel.js";
import { issueAuthToken } from "../services/authTokens.js";
import { MAX_IMAGE_BYTES, saveUploadedImage } from "../services/imageUploads.js";
import { createUploadRouter, createUploadedImagesRouter } from "../routes/uploadRoutes.js";

const userId = "6ab26b08171afea3091f04b3";
const image = (format = "png", width = 8, height = 8) => sharp({
  create: { width, height, channels: 3, background: "#e5b44d" },
}).toFormat(format).toBuffer();

async function setup(t, { brokenStorage = false } = {}) {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-image-upload-secret";
  const directory = await mkdtemp(join(tmpdir(), "the-way-upload-test-"));
  t.after(async () => {
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
    await rm(directory, { recursive: true, force: true });
  });
  const state = {
    directory, user: { _id: userId, role: ["leader"], isAccountVerified: true, tokenVersion: 0, email: "test@example.invalid" },
    counters: new Map(), counterReads: 0, counterOutage: false, userOutage: false,
  };
  t.mock.method(User.collection, "findOne", async () => {
    if (state.userOutage) throw new Error("Private database details");
    return structuredClone(state.user);
  });
  t.mock.method(User.collection, "findOneAndUpdate", async (_filter, update) => {
    Object.assign(state.user, update.$set);
    return structuredClone(state.user);
  });
  t.mock.method(Counters.collection, "findOneAndUpdate", async (filter, update) => {
    state.counterReads++;
    if (state.counterOutage) throw new Error("Private counter details");
    const count = (state.counters.get(filter._id) || 0) + update.$inc.count;
    state.counters.set(filter._id, count);
    return { _id: filter._id, count, expiresAt: update.$setOnInsert?.expiresAt };
  });
  let uploadDirectory = directory;
  if (brokenStorage) {
    uploadDirectory = join(directory, "not-a-directory");
    await writeFile(uploadDirectory, "occupied");
  }
  state.urls = [];
  // Two independent routers and HTTP servers share only the persistent folder
  // and atomic database counters, just like the production API containers.
  for (let i = 0; i < 2; i++) {
    const app = express();
    app.use(cookieParser());
    app.use("/api/uploads", createUploadRouter({ directory: uploadDirectory }));
    app.use("/uploads", createUploadedImagesRouter({ directory }));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    state.urls.push(`http://127.0.0.1:${server.address().port}`);
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });
  }
  const token = issueAuthToken(state.user);
  state.upload = async (body, { worker = 0, type = "image/png", authenticated = true, headers = {} } = {}) => {
    const response = await fetch(`${state.urls[worker]}/api/uploads/images`, {
      method: "POST", body, headers: {
        "Content-Type": type, ...(authenticated ? { Cookie: `token=${token}` } : {}), ...headers,
      },
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return state;
}

test("JPEG, PNG and WebP uploads are stored as decoded images and readable through another API", async (t) => {
  const state = await setup(t);
  for (const format of ["jpeg", "png", "webp"]) {
    const input = await image(format);
    const result = await state.upload(input, { type: `image/${format}` });
    assert.equal(result.status, 201);
    assert.match(result.body.url, /^\/uploads\/[a-f0-9]{64}\.webp$/);
    const response = await fetch(state.urls[1] + result.body.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("cache-control"), /immutable/);
    const output = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 8);
    assert.equal(metadata.exif, undefined);
    assert.equal(output.length, result.body.size);
    assert.equal((await stat(join(state.directory, basename(result.body.url)))).mode & 0o777, 0o644);
  }
});

test("all current staff roles can upload; non-staff, anonymous, unverified, banned and revoked users cannot write files", async (t) => {
  const state = await setup(t);
  const data = await image();
  for (const role of ["admin", "leader", "pascal", "pamela"]) {
    state.user.role = [role];
    assert.equal((await state.upload(data)).status, 201);
  }
  const files = await readdir(state.directory);
  const reads = state.counterReads;
  assert.equal((await state.upload(data, { authenticated: false })).status, 401);
  state.user.role = ["parent"];
  assert.equal((await state.upload(data)).status, 403);
  state.user.role = ["admin"];
  state.user.isAccountVerified = false;
  assert.equal((await state.upload(data)).body.code, "EMAIL_VERIFICATION_REQUIRED");
  state.user.isAccountVerified = true;
  state.user.isBanned = true;
  assert.equal((await state.upload(data)).body.code, "ACCOUNT_BANNED");
  state.user.isBanned = false;
  state.user.tokenVersion++;
  assert.equal((await state.upload(data)).status, 401);
  state.user = null;
  assert.equal((await state.upload(data)).status, 401);
  assert.equal(state.counterReads, reads);
  assert.deepEqual(await readdir(state.directory), files);
});

test("invalid, empty, oversized, truncated and disguised files are rejected without publishing data", async (t) => {
  const state = await setup(t);
  const png = await image();
  for (const [body, type, status] of [
    [Buffer.from('<svg onload="alert(1)"></svg>'), "image/svg+xml", 415],
    [Buffer.from("<html>not an image</html>"), "image/png", 400],
    [png, "image/jpeg", 400], [png.subarray(0, 20), "image/png", 400],
    [Buffer.alloc(0), "image/png", 400],
    [Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/png", 413],
  ]) {
    const result = await state.upload(body, { type });
    assert.equal(result.status, status);
    assert.equal(result.body.success, false);
  }
  assert.equal((await state.upload(png, { headers: { "Content-Encoding": "gzip" } })).status, 415);
  assert.deepEqual(await readdir(state.directory), []);
});

test("oversized dimensions are bounded and image metadata is stripped", async (t) => {
  const state = await setup(t);
  const original = await sharp(await image("jpeg", 3000, 20)).withMetadata().jpeg().toBuffer();
  const result = await state.upload(original, { type: "image/jpeg" });
  assert.equal(result.status, 201);
  const metadata = await sharp(await readFile(join(state.directory, basename(result.body.url)))).metadata();
  assert.equal(metadata.width, 2560);
  assert.equal(metadata.exif, undefined);
  const tooManyPixels = await image("png", 5001, 4000);
  assert.equal((await state.upload(tooManyPixels)).status, 400);
  const animation = await sharp(Buffer.from([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255]), {
    raw: { width: 2, height: 2, pageHeight: 1, channels: 3 },
  }).webp().toBuffer();
  assert.equal((await sharp(animation).metadata()).pages, 2);
  assert.equal((await state.upload(animation, { type: "image/webp" })).status, 400);
});

test("concurrent uploads deduplicate atomically across workers without temporary or partial public files", async (t) => {
  const state = await setup(t);
  const input = await image();
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => state.upload(input, { worker: i % 2 })));
  assert.ok(results.every((result) => result.status === 201));
  assert.equal(new Set(results.map((result) => result.body.url)).size, 1);
  const files = await readdir(state.directory);
  assert.deepEqual(files, [basename(results[0].body.url)]);
  assert.equal((await sharp(await readFile(join(state.directory, files[0]))).metadata()).format, "webp");
});

test("both API workers share upload quotas and counter or identity failures cannot write files", async (t) => {
  const state = await setup(t);
  const data = await image();
  assert.equal((await state.upload(data)).status, 201);
  for (const id of state.counters.keys()) state.counters.set(id, 59);
  const results = await Promise.all([state.upload(data), state.upload(data, { worker: 1 })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 429]);
  assert.equal(results.find((result) => result.status === 429).body.code, "UPLOAD_RATE_LIMITED");
  state.counterOutage = true;
  const unavailable = await state.upload(data);
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(JSON.stringify(unavailable.body), /Private/);
  state.userOutage = true;
  assert.equal((await state.upload(data)).status, 500);
});

test("storage failures return generic errors; missing images and non-image paths never become SPA HTML", async (t) => {
  const state = await setup(t, { brokenStorage: true });
  const result = await state.upload(await image());
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /not-a-directory|ENOTDIR|the-way-upload-test/);
  for (const path of ["/uploads/missing.webp", `/uploads/${"a".repeat(64)}.webp`, "/uploads/.env", "/uploads/%2e%2e%2fpackage.json", "/uploads/"]) {
    assert.equal((await fetch(state.urls[0] + path)).status, 404, path);
  }
  assert.equal((await fetch(`${state.urls[0]}/uploads/${"a".repeat(64)}.webp`, { method: "POST" })).status, 404);
  await assert.rejects(saveUploadedImage(Buffer.from("<svg/>"), "image/svg+xml", state.directory));
});
