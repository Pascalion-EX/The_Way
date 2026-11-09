import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Prayer from "../models/prayerModel.js";
import prayerRouter from "../routes/prayerRoutes.js";
import { canAccessPage, canManagePrayers, pageAccessRoles } from "../../shared/pageAccess.mjs";
import { getPrayerSlides } from "../../shared/prayerSlides.mjs";

const userId = "6ab26b08171afea3091f04b3";
const otherId = "6ab26b08171afea3091f04b4";
const prayerId = "6ab26af3171afea3091f04af";
const clone = (value) => JSON.parse(JSON.stringify(value));
const project = (record, fields) => !record ? null : Object.fromEntries(Object.entries(record).filter(([field]) => !fields || fields[field] === 1 || field === "_id"));
const content = { title: "Prayer of thanksgiving", text: { arabic: "صلاة الشكر\n\nنشكرك يا رب", coptic: "", english: "We give thanks.\n\nAmen." } };

function setup(t) {
  const oldSecret = process.env.JWT_SECRET;
  const oldSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = "test-only-prayer-secret";
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    mongoose.set("sanitizeFilter", oldSanitizer);
  });
  const record = {
    _id: new mongoose.Types.ObjectId(prayerId), ...structuredClone(content),
    createdBy: new mongoose.Types.ObjectId(otherId), updatedBy: new mongoose.Types.ObjectId(otherId),
    createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z"), privateNote: "Private field",
  };
  const state = {
    user: { _id: new mongoose.Types.ObjectId(userId), role: ["parent"], tokenVersion: 0, isAccountVerified: true },
    records: new Map([[prayerId, record]]), reads: [], writes: [], filters: [], databaseError: false,
  };
  t.mock.method(User.collection, "findOne", async () => state.user);
  t.mock.method(User, "findOneAndUpdate", async () => ({ accessDeniedCount: 1 }));
  const findRecords = (filter) => [...state.records.values()].filter((prayer) => !filter.title || new RegExp(filter.title.$regex, filter.title.$options).test(prayer.title));
  t.mock.method(Prayer.collection, "find", (filter, options) => {
    if (state.databaseError) throw new Error("Private database details");
    state.reads.push(options.projection);
    state.filters.push(filter);
    assert.deepEqual(options.projection, { _id: 1, title: 1 });
    return { toArray: async () => findRecords(filter).slice(options.skip || 0, (options.skip || 0) + (options.limit || state.records.size)).map((prayer) => project(prayer, options.projection)) };
  });
  t.mock.method(Prayer.collection, "countDocuments", async (filter) => findRecords(filter).length);
  t.mock.method(Prayer.collection, "findOne", async (filter, options) => {
    if (state.databaseError) throw new Error("Private database details");
    state.reads.push(options.projection);
    return project(state.records.get(String(filter._id)), options.projection);
  });
  t.mock.method(Prayer.collection, "insertOne", async (record) => {
    if (state.databaseError) throw new Error("Private database details");
    state.records.set(String(record._id), record);
    state.writes.push(record);
    return { acknowledged: true, insertedId: record._id };
  });
  t.mock.method(Prayer.collection, "findOneAndUpdate", async (filter, update, options) => {
    if (state.databaseError) throw new Error("Private database details");
    assert.equal(options.returnDocument, "after");
    const record = state.records.get(String(filter._id));
    if (!record) return null;
    Object.assign(record, update.$set);
    state.writes.push(update.$set);
    return project(record, options.projection);
  });
  t.mock.method(Prayer.collection, "findOneAndDelete", async (filter, options) => {
    if (state.databaseError) throw new Error("Private database details");
    assert.deepEqual(options.projection, { _id: 1 });
    const record = state.records.get(String(filter._id));
    if (!record) return null;
    state.records.delete(String(filter._id));
    state.writes.push({ deleted: String(filter._id) });
    return project(record, options.projection);
  });
  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/prayers", prayerRouter);
  // Forged token claims never replace the database role.
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"] }, process.env.JWT_SECRET, { expiresIn: "1h" });
  state.request = (method = "GET", path = "", body, authenticated = true) => new Promise((resolve, reject) => {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const req = Readable.from(raw === undefined ? [] : [Buffer.from(raw)]);
    req.method = method;
    req.url = `/api/prayers${path}`;
    req.headers = { ...(authenticated ? { cookie: `token=${token}` } : {}),
      ...(raw === undefined ? {} : { "content-type": "application/json", "content-length": Buffer.byteLength(raw) }) };
    req.socket = {};
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (body) => resolve({ status: res.statusCode, body: clone(body), headers });
    app.handle(req, res, (error) => reject(error || new Error("Unexpected prayer route fallthrough")));
  });
  return state;
}

test("all verified members can browse prayers and read multilingual text without author records", async (t) => {
  const state = setup(t);
  for (const role of ["parent", "child", "servant", "admin", "pascal", "pamela", "unAssigned"]) {
    state.user.role = [role];
    const list = await state.request();
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.prayers, [{ _id: prayerId, title: content.title }]);
    const detail = await state.request("GET", `/${prayerId}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.prayer.text, content.text);
    assert.deepEqual(Object.keys(detail.body.prayer).sort(), ["_id", "createdAt", "text", "title", "updatedAt"]);
    assert.doesNotMatch(JSON.stringify(detail.body), /createdBy|updatedBy|Private field/);
    assert.equal(detail.headers.get("cache-control"), "private, no-store");
  }
});

test("only admin, Pascal and Pamela can manage prayers using their current database roles", async (t) => {
  const state = setup(t);
  for (const role of ["servant", "parent", "child", "unAssigned", "unknown"]) {
    state.user.role = [role];
    const forged = { ...content, role: ["admin"], userId: otherId };
    assert.equal((await state.request("POST", "", forged)).status, 403);
    assert.equal((await state.request("PUT", `/${prayerId}`, forged)).status, 403);
    assert.equal((await state.request("DELETE", `/${prayerId}`, forged)).status, 403);
  }
  assert.equal(state.reads.length, 0);
  assert.equal(state.writes.length, 0);
  for (const role of ["admin", "pascal", "pamela"]) {
    state.user.role = [role];
    const created = await state.request("POST", "", { ...content, createdBy: otherId, updatedBy: otherId });
    assert.equal(created.status, 201);
    assert.equal(String(state.records.get(created.body.prayer._id).createdBy), userId);
    assert.equal(created.body.prayer.createdBy, undefined);
    const updated = await state.request("PUT", `/${prayerId}`, { title: "Changed prayer", text: { english: "First section\r\n\r\nSecond section" }, createdBy: userId, updatedBy: otherId });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.prayer.text.english, "First section\n\nSecond section");
    assert.equal(updated.body.prayer.text.arabic, "");
    assert.equal(updated.body.prayer.text.coptic, "");
    assert.equal(String(state.records.get(prayerId).createdBy), otherId);
    assert.equal(String(state.records.get(prayerId).updatedBy), userId);
  }
  state.user.role = ["servant", "pamela"];
  assert.equal((await state.request("POST", "", content)).status, 201);
  state.user.role = ["servant"];
  assert.equal((await state.request("PUT", `/${prayerId}`, content)).status, 403);
  assert.equal((await state.request("DELETE", `/${prayerId}`)).status, 403);
});

test("prayer managers can delete a prayer without changing other prayers or returning private data", async (t) => {
  const state = setup(t);
  const original = clone(state.records.get(prayerId));
  for (const roles of [["admin"], ["pascal"], ["pamela"], ["servant", "pamela"]]) {
    state.user.role = roles;
    const created = await state.request("POST", "", content);
    const id = created.body.prayer._id;
    const deleted = await state.request("DELETE", `/${id}`, { _id: prayerId, userId: otherId });
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, { success: true, message: "Prayer deleted" });
    assert.equal(deleted.headers.get("cache-control"), "private, no-store");
    assert.equal(state.records.has(id), false);
    assert.equal((await state.request("GET", `/${id}`)).status, 404);
    assert.equal((await state.request("DELETE", `/${id}`)).status, 404);
    assert.equal((await state.request()).body.prayers.some((prayer) => prayer._id === id), false);
    assert.deepEqual(clone(state.records.get(prayerId)), original);
  }
});

test("prayer routes reject anonymous, unverified, banned and revoked accounts", async (t) => {
  const state = setup(t);
  for (const [method, path, body] of [["GET", ""], ["GET", `/${prayerId}`], ["POST", "", content], ["PUT", `/${prayerId}`, content], ["DELETE", `/${prayerId}`]]) {
    assert.equal((await state.request(method, path, body, false)).status, 401);
    state.user.isAccountVerified = false;
    assert.equal((await state.request(method, path, body)).body.code, "EMAIL_VERIFICATION_REQUIRED");
    state.user.isAccountVerified = true;
    state.user.isBanned = true;
    assert.equal((await state.request(method, path, body)).body.code, "ACCOUNT_BANNED");
    state.user.isBanned = false;
    state.user.tokenVersion = 1;
    assert.equal((await state.request(method, path, body)).status, 401);
    state.user.tokenVersion = 0;
  }
  assert.equal(state.reads.length, 0);
  assert.equal(state.writes.length, 0);
});

test("prayers require a bounded title and nonempty text in a supported language", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  const invalid = [{}, { ...content, title: " " }, { ...content, title: {} }, { ...content, title: "a".repeat(121) },
    { title: "Prayer", text: null }, { title: "Prayer", text: [] }, { title: "Prayer", text: { english: "  " } },
    { title: "Prayer", text: { french: "Unsupported language" } }, { title: "Prayer", text: { arabic: { $ne: "" } } }];
  for (const body of invalid) {
    assert.equal((await state.request("POST", "", body)).status, 400);
    assert.equal((await state.request("PUT", `/${prayerId}`, body)).status, 400);
  }
  assert.equal((await state.request("POST", "", { title: "Large prayer", text: { english: "a".repeat(81 * 1024) } })).status, 413);
  assert.equal(state.writes.length, 0);
});

test("prayer search escapes regex syntax, rejects invalid filters and paginates small title-only cards", async (t) => {
  const state = setup(t);
  for (let index = 1; index <= 6; index++) {
    const id = new mongoose.Types.ObjectId();
    state.records.set(String(id), { ...state.records.get(prayerId), _id: id });
  }
  const paged = await state.request("GET", "?page=2");
  assert.equal(paged.status, 200);
  assert.equal(paged.body.prayers.length, 1);
  assert.deepEqual(paged.body.pagination, { page: 2, pageSize: 6, totalItems: 7, totalPages: 2 });
  for (const card of paged.body.prayers) assert.deepEqual(Object.keys(card).sort(), ["_id", "title"]);
  assert.equal((await state.request("GET", "?search=THANKSGIVING")).body.prayers.length, 7);
  const search = "Prayer [1].*+?^${}|\\";
  assert.equal((await state.request("GET", `?search=${encodeURIComponent(search)}`)).status, 200);
  const pattern = state.filters.at(-1).title;
  assert.equal(new RegExp(pattern.$regex, pattern.$options).test(search), true);
  assert.equal(new RegExp(pattern.$regex, pattern.$options).test("Prayer 1"), false);
  for (const query of ["?page=0", "?page=hello", "?search=a&search=b", `?search=${"a".repeat(201)}`]) assert.equal((await state.request("GET", query)).status, 400);
});

test("invalid and missing prayers return useful responses while database failures remain private", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await state.request(method, "/invalid", method === "PUT" ? content : undefined)).status, 400);
    assert.equal((await state.request(method, `/${otherId}`, method === "PUT" ? content : undefined)).status, 404);
  }
  state.databaseError = true;
  for (const [method, path, body] of [["GET", ""], ["GET", `/${prayerId}`], ["POST", "", content], ["PUT", `/${prayerId}`, content], ["DELETE", `/${prayerId}`]]) {
    const response = await state.request(method, path, body);
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(response.body), /Private database|createdBy|updatedBy/);
  }
});

test("prayer editor page permissions match API management permissions and allow all members to view", () => {
  for (const roles of [["admin"], ["pascal"], ["pamela"], ["servant", "pamela"], ["servant"], ["parent"], ["child"], []]) {
    const expected = roles.some((role) => ["admin", "pascal", "pamela"].includes(role));
    assert.equal(canManagePrayers(roles), expected);
    assert.equal(canAccessPage("/prayer/new", roles), expected);
    assert.equal(canAccessPage(`/prayer/${prayerId}/edit`, roles), expected);
    assert.equal(canAccessPage(`/PRAYER/${prayerId}/EDIT/`, roles), expected);
    assert.equal(canAccessPage("/prayer", roles), true);
    assert.equal(canAccessPage(`/prayer/${prayerId}`, roles), true);
  }
  assert.deepEqual(pageAccessRoles("/prayer/new"), ["admin", "pascal", "pamela"]);
});

test("prayer slide images are saved, read, reordered and removed independently for each language", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  const images = ["a", "b", "c"].map((letter) => `/uploads/${letter.repeat(64)}.webp`);
  const payload = { title: "Illustrated prayer", slides: {
    arabic: [{ text: "النص الأول\n\nفقرة في نفس الشريحة", image: images[0] }, { text: "", image: images[1] }],
    coptic: [], english: [{ text: "English slide", image: images[2] }],
  } };
  const created = await state.request("POST", "", payload);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.prayer.slides, payload.slides);
  const id = created.body.prayer._id;
  const detail = await state.request("GET", `/${id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.prayer.slides, payload.slides);
  assert.equal(detail.body.prayer.text.english, "English slide");
  assert.equal(getPrayerSlides(detail.body.prayer, "arabic").length, 2, "Blank lines inside a structured slide do not detach its image");
  const reordered = { ...payload, slides: { ...payload.slides, arabic: [...payload.slides.arabic].reverse() } };
  assert.equal((await state.request("PUT", `/${id}`, reordered)).status, 200);
  const saved = (await state.request("GET", `/${id}`)).body.prayer;
  assert.equal(saved.slides.arabic[0].image, images[1]);
  assert.equal(saved.slides.arabic[1].image, images[0]);
  reordered.slides.arabic[1] = { ...reordered.slides.arabic[1], image: "" };
  const removed = await state.request("PUT", `/${id}`, reordered);
  assert.equal(removed.body.prayer.slides.arabic[1].image, "");
  assert.equal(removed.body.prayer.slides.english[0].image, images[2]);
  const imageOnly = await state.request("POST", "", { title: "Image prayer", slides: { english: [{ image: images[0] }] } });
  assert.equal(imageOnly.status, 201);
  assert.equal(imageOnly.body.prayer.text.english, "");
  assert.deepEqual(imageOnly.body.prayer.slides.english, [{ text: "", image: images[0] }]);
  state.user.role = ["servant"];
  assert.equal((await state.request("PUT", `/${id}`, payload)).status, 403);
  state.user.role = ["parent"];
  assert.equal((await state.request("GET", `/${id}`)).status, 200);
});

test("slide images must come from image uploads and invalid slides cannot modify a prayer", async (t) => {
  const state = setup(t);
  state.user.role = ["pamela"];
  for (const image of ["https://example.com/image.jpg", "data:image/png;base64,abc", "javascript:alert(1)", "/uploads/../../secret", {}, null, 7]) {
    const result = await state.request("PUT", `/${prayerId}`, { title: "Invalid", slides: { english: [{ text: "Text", image }] } });
    assert.equal(result.status, 400, JSON.stringify(image));
  }
  for (const slides of [null, [], { english: {} }, { english: [null] }, { english: [{ text: {} }] }, { english: [{}] }, {}]) {
    assert.equal((await state.request("POST", "", { title: "Invalid", slides })).status, 400);
  }
  assert.equal((await state.request("POST", "", { title: "Too long", slides: { english: [{ text: "a".repeat(81 * 1024) }] } })).status, 413);
  assert.equal(state.writes.length, 0);
  const invalidModel = new Prayer({ title: "Invalid", slides: { english: [{ text: "Text", image: "javascript:bad" }] }, createdBy: userId, updatedBy: userId });
  assert.ok(invalidModel.validateSync().errors["slides.english.0.image"]);
});

test("legacy prayers retain blank-line slides and text-only API clients can still save prayers", async (t) => {
  const state = setup(t);
  const legacy = (await state.request("GET", `/${prayerId}`)).body.prayer;
  assert.deepEqual(getPrayerSlides(legacy, "english"), [{ text: "We give thanks.", image: "" }, { text: "Amen.", image: "" }]);
  const hydrated = new Prayer({ ...content, createdBy: userId, updatedBy: userId });
  assert.equal(getPrayerSlides(hydrated, "english").length, 2);
  state.user.role = ["pascal"];
  const saved = await state.request("POST", "", content);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.prayer.slides.english.length, 2);
  assert.equal(saved.body.prayer.slides.english[1].image, "");
});
