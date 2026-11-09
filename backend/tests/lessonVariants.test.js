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

function matchesLesson(lesson, filter) {
  return Object.entries(filter).every(([field, condition]) => {
    if (field === "$and") return condition.every((part) => matchesLesson(lesson, part));
    if (field === "$or") return condition.some((part) => matchesLesson(lesson, part));
    const values = field.startsWith("partitions.")
      ? lesson.partitions.map((partition) => partition[field.split(".")[1]])
      : [lesson[field]];
    if (condition?.$regex !== undefined) {
      return values.some((value) => new RegExp(condition.$regex, condition.$options).test(value || ""));
    }
    if (condition?.$in) return values.some((value) => condition.$in.some((id) => String(id) === String(value)));
    if (condition && Object.hasOwn(condition, "$ne")) return values.every((value) => value != condition.$ne);
    return values.some((value) => condition == null ? value == null : String(value) === String(condition));
  });
}

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
    image: "https://example.com/image.jpg", video: "https://www.youtube.com/embed/M7lc1UVf-VE", activity: "Discuss together",
    year: 3, createdBy: objectId(userId), createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
  };
  const state = {
    user: { _id: objectId(userId), role: ["servant"], tokenVersion: 0, isAccountVerified: true, email: "staff@example.com" },
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
  t.mock.method(Lesson.collection, "distinct", async (field, filter) => {
    assert.equal(field, "variantGroup");
    return [...new Map([...state.lessons.values()]
      .filter((lesson) => matchesLesson(lesson, filter))
      .map((lesson) => [String(lesson.variantGroup), lesson.variantGroup])).values()];
  });
  t.mock.method(Lesson.collection, "countDocuments", async (filter) =>
    [...state.lessons.values()].filter((lesson) => matchesLesson(lesson, filter)).length
  );
  t.mock.method(Lesson.collection, "find", (filter, options) => {
    state.filters.push(filter);
    if (Object.hasOwn(filter, "variantGroup")) {
      assert.equal(filter.variantGroup, null);
      return { toArray: async () => [...state.lessons.values()]
        .filter((lesson) => matchesLesson(lesson, filter))
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt) || String(b._id).localeCompare(String(a._id)))
        .slice(options.skip || 0, (options.skip || 0) + (options.limit || state.lessons.size)) };
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

test("variants cannot copy unsafe legacy video URLs and normalize supported source videos", async (t) => {
  const state = setup(t);
  const source = state.lessons.get(lessonId);
  source.video = "https://attacker.example/watch?next=youtube.com/embed";
  assert.equal((await state.create("Unsafe copy")).status, 400);
  assert.equal(state.writes, 0);
  source.video = "https://youtu.be/M7lc1UVf-VE?si=tracking";
  const result = await state.create("Safe copy");
  assert.equal(result.status, 201);
  assert.equal(result.body.lesson.video, "https://www.youtube.com/embed/M7lc1UVf-VE");
});

test("lesson lists keep one card per original while the dropdown retains every variant", async (t) => {
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

test("year filters include an original when its variants match the requested age group", async (t) => {
  const state = setup(t);
  state.lessons.get(unrelatedId).variantGroup = null;
  const first = (await state.create("Year 7 group")).body.lesson;
  const updated = await state.request("PUT", first._id, { ...first, year: 7 });
  assert.equal(updated.status, 200);
  const second = (await state.create("Another year 7 group", first._id)).body.lesson;
  assert.equal(second.year, 7);

  for (const path of ["?year=7", "?year=7&search=church", "?year=7&page=1"]) {
    const result = await state.request("GET", path);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.lessons.map(({ _id }) => _id), [lessonId]);
    if (path.includes("page=")) {
      assert.deepEqual(result.body.pagination, { page: 1, pageSize: 6, totalItems: 1, totalPages: 1 });
    }
  }
  for (const path of ["?year=8", "?year=7&search=Unrelated"]) {
    const result = await state.request("GET", path);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.lessons, []);
  }
  for (const path of ["", "?year=0", "?year=3"]) {
    const result = await state.request("GET", path);
    assert.deepEqual(result.body.lessons.map(({ _id }) => _id), [lessonId, unrelatedId]);
  }

  assert.equal((await state.request("DELETE", first._id)).status, 200);
  assert.deepEqual((await state.request("GET", "?year=7")).body.lessons.map(({ _id }) => _id), [lessonId]);
  assert.equal((await state.request("DELETE", second._id)).status, 200);
  assert.deepEqual((await state.request("GET", "?year=7")).body.lessons, []);
});

test("variant age matches paginate original lessons without duplicate cards or counts", async (t) => {
  const state = setup(t);
  state.lessons.delete(unrelatedId);
  const original = state.lessons.get(lessonId);
  const originals = [original, ...Array.from({ length: 6 }, () => ({ ...original, _id: new mongoose.Types.ObjectId() }))];
  for (const lesson of originals) {
    state.lessons.set(String(lesson._id), lesson);
    for (const name of ["First year 7 group", "Second year 7 group"]) {
      const variant = (await state.create(name, String(lesson._id))).body.lesson;
      state.lessons.get(variant._id).year = 7;
    }
  }
  const first = await state.request("GET", "?year=7&page=1");
  const second = await state.request("GET", "?year=7&page=2");
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.lessons.length, 6);
  assert.equal(second.body.lessons.length, 1);
  assert.deepEqual(first.body.pagination, { page: 1, pageSize: 6, totalItems: 7, totalPages: 2 });
  assert.deepEqual(second.body.pagination, { page: 2, pageSize: 6, totalItems: 7, totalPages: 2 });
  const ids = [...first.body.lessons, ...second.body.lessons].map(({ _id }) => _id);
  assert.equal(new Set(ids).size, 7);
  assert.deepEqual(ids.sort(), originals.map(({ _id }) => String(_id)).sort());
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
  for (const role of ["admin", "servant", "pascal", "pamela"]) {
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

test("a variant can use imported content and an uploaded image while preserving its source and siblings", async (t) => {
  const state = setup(t);
  const sibling = (await state.create("Existing variant")).body.lesson;
  const before = clone(state.lessons.get(lessonId));
  const image = `/uploads/${"a".repeat(64)}.webp`;
  const result = await state.request("POST", `${lessonId}/variants`, {
    name: "Imported variant", image,
    draft: { title: " Imported title ", body: "Ignored legacy body", year: 12, createdBy: unrelatedId,
      partitions: [{ _id: unrelatedId, title: " Section ", body: " New document content " }] },
    variantGroup: unrelatedId, createdBy: unrelatedId, year: 12,
  });
  assert.equal(result.status, 201);
  const copy = result.body.lesson;
  assert.equal(copy.title, "Imported title");
  assert.equal(copy.image, image);
  assert.equal(copy.body, "");
  assert.deepEqual(copy.partitions.map(({ title, body }) => ({ title, body })), [{ title: "Section", body: "New document content" }]);
  assert.notEqual(copy.partitions[0]._id, unrelatedId);
  assert.equal(copy.variantGroup, lessonId);
  assert.equal(copy.createdBy, userId);
  for (const field of ["year", "video", "activity"]) assert.deepEqual(copy[field], before[field]);
  assert.deepEqual(clone(state.lessons.get(lessonId)), before);
  assert.equal(state.lessons.get(sibling._id).title, before.title);
});

test("document and image replacement are optional independently, including on legacy sources", async (t) => {
  const state = setup(t);
  const before = clone(state.lessons.get(lessonId));
  const image = `/uploads/${"b".repeat(64)}.webp`;
  const imageOnly = await state.request("POST", `${lessonId}/variants`, { name: "New image", image });
  assert.equal(imageOnly.status, 201);
  assert.equal(imageOnly.body.lesson.image, image);
  assert.equal(imageOnly.body.lesson.title, before.title);
  assert.deepEqual(imageOnly.body.lesson.partitions.map(({ title, body }) => ({ title, body })),
    before.partitions.map(({ title, body }) => ({ title, body })));
  Object.assign(state.lessons.get(lessonId), { body: "Legacy source text", partitions: [] });
  const draft = { title: "New content", partitions: [{ title: "Section", body: "Imported body" }] };
  const documentOnly = await state.request("POST", `${lessonId}/variants`, { name: "New document", draft });
  assert.equal(documentOnly.status, 201);
  assert.equal(documentOnly.body.lesson.image, before.image);
  assert.equal(documentOnly.body.lesson.body, "");
  assert.equal(documentOnly.body.lesson.partitions[0].body, "Imported body");
  assert.equal(state.lessons.get(lessonId).body, "Legacy source text");
});

test("invalid imported drafts and images cannot create partial variants", async (t) => {
  const state = setup(t);
  const partition = { title: "Section", body: "Content" };
  for (const draft of [null, "text", [], {}, { title: "", partitions: [partition] },
    { title: "Title", partitions: [] }, { title: "Title", partitions: {} },
    { title: "Title", partitions: [null] }, { title: "Title", partitions: [{ ...partition, body: " " }] },
    { title: "Title", partitions: [{ ...partition, title: { $ne: "" } }] },
    { title: "Title", partitions: Array.from({ length: 101 }, () => partition) }]) {
    assert.equal((await state.request("POST", `${lessonId}/variants`, { name: "Invalid draft", draft })).status, 400);
  }
  const large = await state.request("POST", `${lessonId}/variants`, {
    name: "Too much content", draft: { title: "Title", partitions: [{ title: "Section", body: "a".repeat(81 * 1024) }] },
  });
  assert.equal(large.status, 413);
  for (const image of [null, "", "https://example.com/image.jpg", "javascript:alert(1)", {}, []]) {
    assert.equal((await state.request("POST", `${lessonId}/variants`, { name: "Invalid image", image })).status, 400);
  }
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
});
