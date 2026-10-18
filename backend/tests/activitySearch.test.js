import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import Activity from "../models/activitiesModel.js";
import { getAllActivities } from "../controllers/activitiesController.js";

function setup(t) {
  const previousSanitizer = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previousSanitizer));

  const filters = [];
  // Keep Mongoose's actual sanitization and casting; stub only database I/O.
  t.mock.method(Activity.collection, "find", (filter) => {
    filters.push(filter);
    return { toArray: async () => [] };
  });

  const request = async (query) => {
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await getAllActivities({ query }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.activities, []);
    return filters.at(-1);
  };

  return request;
}

test("activity search preserves case-insensitive regex filters through Mongoose sanitization", async (t) => {
  const request = setup(t);
  const filter = await request({ search: "  Jesus  " });

  assert.deepEqual(filter.$or.map((part) => Object.keys(part)[0]), [
    "name", "materials", "explanation",
  ]);
  for (const part of filter.$or) {
    const condition = Object.values(part)[0];
    assert.equal(condition.$regex, "Jesus");
    assert.equal(condition.$options, "i");
    assert.equal(new RegExp(condition.$regex, condition.$options).test("About JESUS"), true);
  }
});

test("activity search treats regex metacharacters as literal text", async (t) => {
  const request = setup(t);
  const search = "Jesus (craft) [1].*+?^${}|\\";
  const filter = await request({ search });

  for (const part of filter.$or) {
    const condition = Object.values(part)[0];
    const regex = new RegExp(condition.$regex, condition.$options);
    assert.equal(regex.test(search), true);
    assert.equal(regex.test("Jesus craft 1"), false);
  }
});

test("activity listing accepts missing, empty, and whitespace-only searches", async (t) => {
  const request = setup(t);
  for (const query of [{}, { search: "" }, { search: "   " }]) {
    assert.deepEqual(await request(query), {});
  }
});
