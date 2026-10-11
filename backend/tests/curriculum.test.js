import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import curriculumModel from "../models/curriculumModel.js";
import lessonModel from "../models/lessonModel.js";
import userModel from "../models/userModel.js";
import {
  createCurriculum, getcurriculum, getCurriculumById, updateCurriculum, deleteCurriculum,
} from "../controllers/curriculumController.js";
import { validateCurriculumTree } from "../utils/curriculumTree.js";

const userId = "6ab26b08171afea3091f04b3";
const curriculumId = "6ab26b08171afea3091f04b4";
const lessonId = "6ab26b08171afea3091f04b2";
const nodes = [
  { id: "intro", lesson: lessonId, parentId: "root" },
  { id: "branch", lesson: lessonId, parentId: "intro" },
  { id: "sibling", lesson: lessonId, parentId: "root" },
];
const response = () => ({
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const curriculumRecord = () => ({
  _id: new mongoose.Types.ObjectId(curriculumId),
  name: "Faith", nodes, createdBy: new mongoose.Types.ObjectId(userId), __v: 0,
});
const allowEditor = (t, role = ["leader"]) =>
  t.mock.method(userModel, "findById", async () => ({ role }));
const populateLessons = (t) => t.mock.method(lessonModel.collection, "find", () => ({
  toArray: async () => [{ _id: new mongoose.Types.ObjectId(lessonId), title: "Introduction" }],
}));

test("tree accepts branching, out-of-order nodes, and an empty named root", () => {
  assert.equal(validateCurriculumTree([...nodes].reverse()), null);
  assert.equal(validateCurriculumTree([]), null);
});

test("tree rejects duplicate ids, extra roots, missing parents, and cycles", () => {
  for (const invalid of [
    null, {}, [null],
    [{ id: "root", parentId: "root" }],
    [nodes[0], nodes[0]],
    [{ id: "intro", parentId: "missing" }],
    [{ id: "intro", parentId: "intro" }],
    [{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }],
    [{ id: "a" }],
  ]) assert.ok(validateCurriculumTree(invalid));
});

test("model requires a name and enforces the tree on save validation", async () => {
  await assert.rejects(new curriculumModel({ createdBy: userId }).validate(), /name/);
  await assert.rejects(new curriculumModel({
    name: "Faith", createdBy: userId,
    nodes: [{ id: "intro", parentId: "intro", lesson: lessonId }],
  }).validate(), /connected tree/);
  await new curriculumModel({ name: "Faith", createdBy: userId, nodes }).validate();
});

test("create persists a tree and returns its named root with populated lesson nodes", async (t) => {
  allowEditor(t);
  const previous = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previous));
  t.mock.method(lessonModel.collection, "countDocuments", async (filter) => {
    assert.deepEqual(filter._id.$in.map(String), [lessonId]);
    return 1;
  });
  const insert = t.mock.method(curriculumModel.collection, "insertOne", async (doc) => ({ insertedId: doc._id }));
  populateLessons(t);
  const res = response();
  await createCurriculum({ userId, body: { name: " Faith ", nodes, createdBy: "ignored" } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(insert.mock.callCount(), 1);
  assert.equal(String(res.body.curriculum.createdBy), userId);
  assert.equal(res.body.curriculum.name, "Faith");
  assert.deepEqual(res.body.curriculum.graph.nodes[0], { id: "root", type: "root", label: "Faith" });
  assert.equal(res.body.curriculum.graph.nodes[1].lesson.title, "Introduction");
  assert.deepEqual(res.body.curriculum.graph.edges, [
    { source: "root", target: "intro" },
    { source: "intro", target: "branch" },
    { source: "root", target: "sibling" },
  ]);
});

test("create rejects invalid names, invalid references, missing lessons, and invalid trees before writing", async (t) => {
  allowEditor(t);
  t.mock.method(lessonModel, "countDocuments", async () => 0);
  const create = t.mock.method(curriculumModel, "create", async () => assert.fail("Unexpected write"));
  for (const body of [
    undefined, { name: " " }, { name: 123 },
    { name: "Faith", nodes: null },
    { name: "Faith", nodes: [{ ...nodes[0], lesson: "bad-id" }] },
    { name: "Faith", nodes },
    { name: "Faith", nodes: [{ ...nodes[0], parentId: "intro" }] },
  ]) {
    const res = response();
    await createCurriculum({ userId, body }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(create.mock.callCount(), 0);
});

test("creating with just a name creates the root without requiring a lesson", async (t) => {
  allowEditor(t, "admin");
  t.mock.method(curriculumModel.collection, "insertOne", async (doc) => ({ insertedId: doc._id }));
  const res = response();
  await createCurriculum({ userId, body: { name: "Faith" } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body.curriculum.nodes, []);
  assert.deepEqual(res.body.curriculum.graph, {
    rootId: "root",
    nodes: [{ id: "root", type: "root", label: "Faith" }],
    edges: [],
  });
});

test("all mutations reject readers without an editing role", async (t) => {
  allowEditor(t, ["parent"]);
  for (const controller of [createCurriculum, updateCurriculum, deleteCurriculum]) {
    const res = response();
    await controller({ userId, params: { curriculumId }, body: { name: "Faith" } }, res);
    assert.equal(res.statusCode, 403);
  }
});

test("read endpoints return graph data and handle invalid or missing ids", async (t) => {
  populateLessons(t);
  t.mock.method(curriculumModel.collection, "find", () => ({ toArray: async () => [curriculumRecord()] }));
  const find = t.mock.method(curriculumModel.collection, "findOne", async () => curriculumRecord());
  const list = response();
  await getcurriculum({}, list);
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.curriculum[0].graph.nodes.length, 4);
  const read = response();
  await getCurriculumById({ params: { curriculumId } }, read);
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.curriculum.graph.nodes[1].label, "Introduction");
  const invalid = response();
  await getCurriculumById({ params: { curriculumId: "bad-id" } }, invalid);
  assert.equal(invalid.statusCode, 400);
  find.mock.mockImplementation(async () => null);
  const missing = response();
  await getCurriculumById({ params: { curriculumId } }, missing);
  assert.equal(missing.statusCode, 404);
});

test("renaming updates the root label while preserving nodes and uses a version guard", async (t) => {
  allowEditor(t);
  t.mock.method(curriculumModel.collection, "findOne", async () => curriculumRecord());
  populateLessons(t);
  const write = t.mock.method(curriculumModel.collection, "updateOne", async (filter, update) => {
    assert.equal(filter.__v, 0);
    assert.equal(update.$set.name, "New name");
    assert.equal(update.$set.nodes, undefined);
    return { matchedCount: 1, modifiedCount: 1 };
  });
  const res = response();
  await updateCurriculum({ userId, params: { curriculumId }, body: { name: "New name" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(res.body.curriculum.nodes.length, 3);
  assert.equal(res.body.curriculum.graph.nodes[0].label, "New name");
});

test("reading keeps the tree connected when a referenced lesson has been deleted", async (t) => {
  t.mock.method(curriculumModel.collection, "findOne", async () => curriculumRecord());
  t.mock.method(lessonModel.collection, "find", () => ({ toArray: async () => [] }));
  const res = response();
  await getCurriculumById({ params: { curriculumId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.curriculum.graph.nodes[1].label, "Unavailable lesson");
  assert.equal(res.body.curriculum.graph.nodes[1].lesson, null);
  assert.equal(res.body.curriculum.graph.edges.length, 3);
});

test("updates replace the full lesson tree, including clearing to the named root", async (t) => {
  allowEditor(t);
  t.mock.method(curriculumModel.collection, "findOne", async () => curriculumRecord());
  t.mock.method(lessonModel, "countDocuments", async () => 1);
  populateLessons(t);
  t.mock.method(curriculumModel.collection, "updateOne", async () => ({ matchedCount: 1, modifiedCount: 1 }));
  for (const replacement of [[{ ...nodes[0], id: "new" }], []]) {
    const res = response();
    await updateCurriculum({ userId, params: { curriculumId }, body: { nodes: replacement } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.curriculum.nodes.length, replacement.length);
    assert.equal(res.body.curriculum.graph.nodes[0].label, "Faith");
  }
});

test("updates reject invalid trees and report concurrent changes", async (t) => {
  allowEditor(t);
  t.mock.method(curriculumModel.collection, "findOne", async () => curriculumRecord());
  const write = t.mock.method(curriculumModel.collection, "updateOne", async () => ({ matchedCount: 0 }));
  const invalid = response();
  await updateCurriculum({ userId, params: { curriculumId }, body: { nodes: [nodes[1]] } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(write.mock.callCount(), 0);
  const conflict = response();
  await updateCurriculum({ userId, params: { curriculumId }, body: { name: "Changed" } }, conflict);
  assert.equal(conflict.statusCode, 409);
});

test("deleting a curriculum does not delete the referenced lessons", async (t) => {
  allowEditor(t);
  const remove = t.mock.method(curriculumModel, "findByIdAndDelete", async () => curriculumRecord());
  const lessons = t.mock.method(lessonModel, "deleteMany", async () => assert.fail("Lessons must be preserved"));
  const res = response();
  await deleteCurriculum({ userId, params: { curriculumId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(lessons.mock.callCount(), 0);
  remove.mock.mockImplementation(async () => null);
  const missing = response();
  await deleteCurriculum({ userId, params: { curriculumId } }, missing);
  assert.equal(missing.statusCode, 404);
});
