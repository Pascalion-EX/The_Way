import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Lesson from "../models/lessonModel.js";
import User from "../models/userModel.js";
import lessonRouter from "../routes/lessonRoutes.js";

const userId = "6ab26b08171afea3091f04b3";
const lessonId = "6ab26af3171afea3091f04af";
const unrelatedId = "6ab26af3171afea3091f04ae";
const objectId = (id) => new mongoose.Types.ObjectId(id);
const clone = (value) => JSON.parse(JSON.stringify(value));

function setup(t) {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = "test-only-lesson-variants-secret";
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const source = {
    _id: objectId(lessonId), title: "The secrets of the church", name: "Gifts of the church",
    body: "", partitions: [{ _id: new mongoose.Types.ObjectId(), title: "Introduction", body: "Lesson content" }],
    image: "https://example.com/image.jpg", video: "https://youtu.be/example", activity: "Discuss together",
    year: 3, createdBy: objectId(userId), createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  };
  const state = {
    user: { _id: objectId(userId), role: ["leader"], tokenVersion: 0, isAccountVerified: true, email: "staff@example.com" },
    lessons: new Map([[lessonId, source], [unrelatedId, { ...source, _id: objectId(unrelatedId), name: "Unrelated lesson" }]]),
    reads: 0, writes: 0, filters: [],
  };
  t.mock.method(User.collection, "findOne", async () => state.user);
  t.mock.method(User.collection, "find", () => ({ toArray: async () => [state.user] }));
  t.mock.method(User, "findOneAndUpdate", async () => ({ accessDeniedCount: 1 }));
  // Exercise real routing, authorization, Mongoose casting, defaults, validation,
  // and document copying; replace only the database collection operations.
  t.mock.method(Lesson.collection, "findOne", async (filter) => {
    state.reads++;
    return state.lessons.get(String(filter._id)) || null;
  });
  t.mock.method(Lesson.collection, "insertOne", async (document) => {
    state.writes++;
    state.lessons.set(String(document._id), document);
    return { acknowledged: true, insertedId: document._id };
  });
  t.mock.method(Lesson.collection, "find", (filter, options) => {
    state.filters.push(filter);
    if (Object.hasOwn(filter, "variantGroup")) {
      assert.equal(filter.variantGroup, null);
      return { toArray: async () => [...state.lessons.values()].filter((lesson) =>
        lesson.variantGroup == null &&
        (!filter.year || lesson.year === filter.year) &&
        (!filter.$or || filter.$or.some((condition) => {
          const [field, match] = Object.entries(condition)[0];
          const values = field.startsWith("partitions.")
            ? lesson.partitions.map((partition) => partition[field.split(".")[1]])
            : [lesson[field]];
          return values.some((value) => new RegExp(match.$regex, match.$options).test(value || ""));
        }))
      ) };
    }
    const groupId = String(filter.$or[0]._id);
    assert.equal(String(filter.$or[1].variantGroup), groupId);
    assert.deepEqual(options.projection, { name: 1, variantGroup: 1 });
    assert.deepEqual(options.sort, { createdAt: 1, _id: 1 });
    return { toArray: async () => [...state.lessons.values()]
      .filter((lesson) => String(lesson._id) === groupId || String(lesson.variantGroup) === groupId)
      .map(({ _id, name, variantGroup }) => ({ _id, name, variantGroup })) };
  });
  t.mock.method(Lesson.collection, "findOneAndUpdate", async (filter, update) => {
    const lesson = state.lessons.get(String(filter._id));
    Object.assign(lesson, update.$set);
    return lesson;
  });
  t.mock.method(Lesson.collection, "findOneAndDelete", async (filter) => {
    const lesson = state.lessons.get(String(filter._id));
    state.lessons.delete(String(filter._id));
    return lesson;
  });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/lessons", lessonRouter);
  const token = jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  state.request = (method, path, body, authenticated = true) => new Promise((resolve, reject) => {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const req = Readable.from(raw === undefined ? [] : [Buffer.from(raw)]);
    req.method = method;
    req.url = `/api/lessons/${path}`;
    req.headers = {
      ...(raw === undefined ? {} : { "content-type": "application/json", "content-length": Buffer.byteLength(raw) }),
      ...(authenticated ? { cookie: `token=${token}` } : {}),
    };
    req.socket = { remoteAddress: "192.0.2.1" };
    const res = Object.create(express.response);
    const headers = new Map();
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.statusCode = 200;
    res.json = (body) => resolve({ status: res.statusCode, body: clone(body) });
    app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
  });
  state.create = (name, sourceId = lessonId) => state.request("POST", `${sourceId}/variants`, { name });
  return state;
}

test("creating a named variant copies every lesson field with fresh IDs and timestamps", async (t) => {
  const state = setup(t);
  const before = clone(state.lessons.get(lessonId));
  const result = await state.create("  Younger group  ");
  assert.equal(result.status, 201);
  const copy = result.body.lesson;
  assert.equal(copy.name, "Younger group");
  assert.equal(copy.variantGroup, lessonId);
  assert.notEqual(copy._id, lessonId);
  assert.notEqual(copy.partitions[0]._id, before.partitions[0]._id);
  assert.notEqual(copy.createdAt, before.createdAt);
  assert.equal(copy.createdBy, userId);
  for (const field of ["title", "body", "image", "video", "activity", "year"]) {
    assert.deepEqual(copy[field], before[field], field);
  }
  assert.deepEqual(copy.partitions.map(({ title, body }) => ({ title, body })), before.partitions.map(({ title, body }) => ({ title, body })));
  assert.deepEqual(clone(state.lessons.get(lessonId)), before);
  assert.equal(state.writes, 1);
});

test("legacy lessons copy their body and empty optional fields without requiring partitions", async (t) => {
  const state = setup(t);
  Object.assign(state.lessons.get(lessonId), { body: "Legacy content", partitions: [], video: "", activity: "" });
  const result = await state.create("Legacy variant");
  assert.equal(result.status, 201);
  assert.equal(result.body.lesson.body, "Legacy content");
  assert.deepEqual(result.body.lesson.partitions, []);
  assert.equal(result.body.lesson.video, "");
  assert.equal(result.body.lesson.activity, "");
});

test("lesson lists hide variants, including during searches and year filtering, while the dropdown retains them", async (t) => {
  const state = setup(t);
  // Both legacy originals (missing field) and new originals (null) remain listed.
  state.lessons.get(unrelatedId).variantGroup = null;
  const first = (await state.create("Younger group")).body.lesson;
  await state.create("Older group");
  for (const path of ["", "?year=3", "?search=church", "?year=3&search=church"]) {
    const result = await state.request("GET", path);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.lessons.map(({ _id }) => _id), [lessonId, unrelatedId]);
  }
  const search = await state.request("GET", "?search=Younger");
  assert.equal(search.status, 200);
  assert.deepEqual(search.body.lessons, []);
  const detail = await state.request("GET", lessonId);
  assert.equal(detail.body.variants.length, 3);
  assert.ok(detail.body.variants.some(({ _id }) => _id === first._id));
  assert.equal((await state.request("GET", first._id)).status, 200);
});

test("copies made from variants stay in one group and use the selected variant's content", async (t) => {
  const state = setup(t);
  const first = (await state.create("First variant")).body.lesson;
  state.lessons.get(first._id).partitions[0].body = "Adapted content";
  const second = (await state.create("Second variant", first._id)).body.lesson;
  assert.equal(second.variantGroup, lessonId);
  assert.equal(second.partitions[0].body, "Adapted content");
  for (const id of [lessonId, first._id, second._id]) {
    const result = await state.request("GET", id);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.variants.map(({ _id }) => _id), [lessonId, first._id, second._id]);
    assert.equal(result.body.variants[0].variantGroup, null);
    assert.ok(result.body.variants.every((variant) => !Object.hasOwn(variant, "body")));
  }
});

test("editing and deleting variants leave their original and sibling copies intact", async (t) => {
  const state = setup(t);
  const before = clone(state.lessons.get(lessonId));
  const first = (await state.create("First variant")).body.lesson;
  const second = (await state.create("Second variant")).body.lesson;
  const updated = await state.request("PUT", first._id, {
    ...first, name: "Renamed variant", partitions: [{ title: "New section", body: "Changed independently" }],
    variantGroup: unrelatedId,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.lesson.name, "Renamed variant");
  assert.equal(updated.body.lesson.variantGroup, lessonId);
  assert.equal(state.lessons.get(second._id).partitions[0].body, "Lesson content");
  assert.deepEqual(clone(state.lessons.get(lessonId)), before);
  assert.equal((await state.request("DELETE", first._id)).status, 200);
  const remaining = await state.request("GET", lessonId);
  assert.deepEqual(remaining.body.variants.map(({ _id }) => _id), [lessonId, second._id]);
});

test("surviving variants can be opened and copied after the original is deleted", async (t) => {
  const state = setup(t);
  const first = (await state.create("First variant")).body.lesson;
  assert.equal((await state.request("DELETE", lessonId)).status, 200);
  const second = await state.create("Second variant", first._id);
  assert.equal(second.status, 201);
  assert.equal(second.body.lesson.variantGroup, lessonId);
  const result = await state.request("GET", first._id);
  assert.deepEqual(result.body.variants.map(({ _id }) => _id), [first._id, second.body.lesson._id]);
});

test("invalid variant names and IDs are rejected without copying any data", async (t) => {
  const state = setup(t);
  for (const name of [undefined, null, "", "  ", 1, [], { $ne: "" }, "x".repeat(121)]) {
    assert.equal((await state.create(name)).status, 400);
  }
  assert.equal((await state.create("Valid", "invalid-id")).status, 400);
  assert.equal((await state.request("GET", "invalid-id")).status, 400);
  assert.equal(state.reads, 0);
  const missingId = "6ab26af3171afea3091f04aa";
  assert.equal((await state.create("Missing", missingId)).status, 404);
  assert.equal((await state.request("GET", missingId)).status, 404);
  assert.equal(state.writes, 0);
});

test("variant creation uses current lesson permissions and requires verified authentication", async (t) => {
  const state = setup(t);
  for (const role of ["parent", "unAssigned", "unknown"]) {
    state.user.role = [role];
    assert.equal((await state.create("Forbidden")).status, 403);
  }
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
  assert.equal((await state.request("POST", `${lessonId}/variants`, { name: "Anonymous" }, false)).status, 401);
  state.user.isAccountVerified = false;
  assert.equal((await state.create("Unverified")).status, 403);
  state.user.isAccountVerified = true;
  for (const role of ["admin", "leader", "pascal", "pamela"]) {
    state.user.role = [role];
    assert.equal((await state.create(`Variant ${role}`)).status, 201);
  }
  state.user.role = ["parent"];
  assert.equal((await state.request("GET", lessonId)).status, 200);
});

test("variant requests cannot override copied fields, authorship, or group membership", async (t) => {
  const state = setup(t);
  const result = await state.request("POST", `${lessonId}/variants`, {
    name: "Named copy", title: "Forged", body: "Forged", partitions: [], createdBy: unrelatedId,
    variantGroup: unrelatedId, _id: unrelatedId, year: 12,
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.lesson.title, "The secrets of the church");
  assert.equal(result.body.lesson.createdBy, userId);
  assert.equal(result.body.lesson.variantGroup, lessonId);
  assert.equal(result.body.lesson.year, 3);
});
