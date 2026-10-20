import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import Lesson from "../models/lessonModel.js";
import { getLessons } from "../controllers/lessonController.js";

function setup(t) {
  const previousSanitizer = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previousSanitizer));
  const filters = [];
  // Keep real Mongoose sanitization and casting; replace only collection I/O.
  t.mock.method(Lesson.collection, "find", (filter) => {
    filters.push(filter);
    return { toArray: async () => [] };
  });
  const request = async (query) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await getLessons({ query }, res);
    return res;
  };
  return { filters, request };
}

test("lesson searches treat zero, empty, and missing years as no filter while retaining search", async (t) => {
  const { filters, request } = setup(t);
  for (const query of [{}, { year: "" }, { year: "0" }]) {
    const res = await request({ ...query, search: "love" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const filter = filters.at(-1);
    assert.equal(Object.hasOwn(filter, "year"), false);
    assert.ok(filter.$or.some((part) => part.title?.$regex === "love"));
  }
});

test("lesson searches filter by whole years 1 through 12", async (t) => {
  const { filters, request } = setup(t);
  for (let year = 1; year <= 12; year++) {
    const res = await request({ year: String(year) });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(filters.at(-1), { year });
  }
});

test("lesson searches reject invalid years before querying the database", async (t) => {
  const { filters, request } = setup(t);
  for (const year of ["-1", "13", "1.5", "NaN", "Infinity", "invalid", ["1", "2"], { $gt: 0 }]) {
    const res = await request({ year });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  }
  assert.equal(filters.length, 0);
});

test("lesson search supports every content field with sanitization enabled", async (t) => {
  const { filters, request } = setup(t);
  const res = await request({ search: "  jonah  ", year: "3" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  const filter = filters.at(-1);
  assert.equal(filter.year, 3);
  assert.deepEqual(filter.$or.map((part) => Object.keys(part)[0]), [
    "title", "name", "body", "partitions.title", "partitions.body",
  ]);
  for (const part of filter.$or) {
    const condition = Object.values(part)[0];
    assert.equal(condition.$regex, "jonah");
    assert.equal(condition.$options, "i");
    assert.equal(new RegExp(condition.$regex, condition.$options).test("About JONAH"), true);
  }
});

test("lesson search treats regex syntax and incomplete patterns as literal text", async (t) => {
  const { filters, request } = setup(t);
  for (const search of ["Jonah (lesson) [1].*+?^${}|\\", "["]) {
    const res = await request({ search });
    assert.equal(res.statusCode, 200);
    for (const part of filters.at(-1).$or) {
      const condition = Object.values(part)[0];
      const regex = new RegExp(condition.$regex, condition.$options);
      assert.equal(regex.test(search), true);
      assert.equal(regex.test("Jonah lesson 1"), false);
    }
  }
});

test("lesson listing accepts missing, empty and whitespace-only search terms", async (t) => {
  const { filters, request } = setup(t);
  for (const query of [{}, { search: "" }, { search: "   " }]) {
    assert.equal((await request(query)).statusCode, 200);
    assert.deepEqual(filters.at(-1), {});
  }
});

test("lesson search rejects invalid input before querying the database", async (t) => {
  const { filters, request } = setup(t);
  for (const search of [null, 12, ["jonah"], { $regex: "jonah" }, "a".repeat(201)]) {
    const res = await request({ search });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  }
  assert.equal(filters.length, 0);
});
