import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Lesson from "../models/lessonModel.js";
import Activity from "../models/activitiesModel.js";
import Game from "../models/gamesModel.js";
import Chant from "../models/chantModel.js";
import lessonRouter from "../routes/lessonRoutes.js";
import activityRouter from "../routes/activitiesRoutes.js";
import gameRouter from "../routes/gameRoutes.js";
import chantRouter from "../routes/chantRoutes.js";

const userId = "6ab26b08171afea3091f04b3";
const recordId = "6ab26af3171afea3091f04af";
const id = "M7lc1UVf-VE";
const canonical = `https://www.youtube.com/embed/${id}`;
const routes = [
  { prefix: "/lessons", create: "/", router: lessonRouter, model: Lesson, field: "lesson" },
  { prefix: "/activities", create: "/", router: activityRouter, model: Activity, field: "activity" },
  { prefix: "/games", create: "/create", router: gameRouter, model: Game, field: "game" },
  { prefix: "/chants", create: "/create", router: chantRouter, model: Chant, field: "chant" },
];
const validBody = {
  name: "Example", title: "Example", year: 3, image: "https://example.com/image.png",
  materials: "Paper", explanation: "Instructions", body: "Lesson content",
  partitions: [{ title: "Introduction", body: "Lesson content" }], lyrics: { english: "Example lyrics" },
};
const clone = (value) => JSON.parse(JSON.stringify(value));

function setup(t) {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-video-security-secret";
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const state = { writes: [], reads: 0 };
  const user = { _id: userId, tokenVersion: 0, isAccountVerified: true, role: ["leader"] };
  t.mock.method(User.collection, "findOne", async () => user);
  t.mock.method(User.collection, "find", () => ({ toArray: async () => [user] }));
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  for (const route of routes) {
    app.use(route.prefix, route.router);
    const record = { ...clone(validBody), _id: recordId, createdBy: userId, video: canonical };
    t.mock.method(route.model.collection, "findOne", async () => {
      state.reads++;
      return clone(record);
    });
    t.mock.method(route.model.collection, "insertOne", async (document) => {
      state.writes.push(clone(document));
      return { acknowledged: true, insertedId: document._id };
    });
    t.mock.method(route.model.collection, "findOneAndUpdate", async (_filter, update) => {
      state.writes.push(clone(update.$set));
      return { ...record, ...update.$set };
    });
    t.mock.method(route.model.collection, "updateOne", async (_filter, update) => {
      state.writes.push(clone(update.$set));
      Object.assign(record, update.$set);
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    });
  }
  const token = jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  state.request = (route, method, body) => new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const req = Readable.from([Buffer.from(raw)]);
    req.method = method;
    req.url = route.prefix + (method === "POST" ? route.create : `/${recordId}`);
    req.headers = { cookie: `token=${token}`, "content-type": "application/json", "content-length": Buffer.byteLength(raw) };
    req.socket = {};
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (body) => resolve({ status: res.statusCode, body: clone(body) });
    app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
  });
  return state;
}

test("every content create/update route rejects unsafe URLs before reading or modifying content", async (t) => {
  const state = setup(t);
  for (const route of routes) {
    for (const method of ["POST", "PUT"]) {
      for (const video of [
        "https://attacker.example/watch?next=youtube.com/embed",
        "data:text/html,<h1>Untrusted frame</h1>#youtube.com/embed",
        `https://youtube.com.attacker.example/embed/${id}`,
        `http://youtube.com/embed/${id}`, `https://youtube.com/embed/invalid`,
        "javascript:alert(1)", null, 5, [], { $ne: null },
      ]) {
        const result = await state.request(route, method, { ...validBody, video });
        assert.equal(result.status, 400, `${route.prefix} ${method}: ${JSON.stringify(video)}`);
        assert.equal(result.body.success, false);
        assert.match(result.body.message, /HTTPS YouTube/);
      }
    }
  }
  assert.equal(state.reads, 0);
  assert.deepEqual(state.writes, []);
});

test("every content route stores canonical YouTube URLs, accepts native video files, and can clear videos", async (t) => {
  const state = setup(t);
  for (const route of routes) {
    for (const method of ["POST", "PUT"]) {
      for (const [video, expected] of [
        [` https://youtu.be/${id}?si=tracking `, canonical],
        [`${canonical}?start=30&origin=https://attacker.example&enablejsapi=1`, `${canonical}?start=30`],
        ["https://cdn.example.com/recording.mp4?signature=123", "https://cdn.example.com/recording.mp4?signature=123"],
        ["", ""], ["   ", ""],
      ]) {
        const count = state.writes.length;
        const result = await state.request(route, method, { ...validBody, video });
        assert.equal(result.status, method === "POST" ? 201 : 200, `${route.prefix} ${method}: ${JSON.stringify(result.body)}`);
        // Saving an unchanged Game document can legitimately skip a DB write.
        assert.ok(state.writes.length === count || state.writes.length === count + 1);
        if (state.writes.length > count) assert.equal(state.writes.at(-1).video, expected);
        assert.equal(result.body[route.field].video, expected);
      }
    }
  }
});

test("all video models enforce the URL policy even when route validation is bypassed", async () => {
  for (const { model } of routes) {
    const document = new model({ ...validBody, createdBy: new mongoose.Types.ObjectId(userId) });
    for (const video of [canonical, "https://cdn.example.com/recording.webm", ""]) {
      document.video = video;
      await document.validate();
    }
    for (const video of ["https://attacker.example/watch?next=youtube.com/embed", "data:text/html,test#youtube.com/embed", null]) {
      document.video = video;
      await assert.rejects(document.validate(), /Use an HTTPS YouTube/);
    }
  }
});
