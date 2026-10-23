import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import attendanceRouter from "../routes/attendanceRoutes.js";
import User from "../models/userModel.js";
import Child from "../models/childProfileModel.js";
import Attendance from "../models/attendanceModel.js";

const userId = "6ab26b08171afea3091f04b3";
const childIds = ["6ac82222376fb9c75f5b3961", "6ab26af3171afea3091f04af"];
const recordIds = ["6ab26b08171afea3091f04b2", "6ab26b08171afea3091f04b4"];
const serviceDate = "2026-10-14";
const objectId = (id) => new mongoose.Types.ObjectId(id);

const matches = (document, filter) => Object.entries(filter).every(([key, value]) => {
  if (value?.$in) return value.$in.some((item) => String(document[key]) === String(item));
  if (value?.$lte) return document[key] <= value.$lte;
  return String(document[key]) === String(value);
});

const setup = (t, roles = ["leader"], assignedClass = 1) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = "test-only-attendance-class-secret";
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const children = childIds.map((id, index) => ({ _id: objectId(id), name: `Child ${index}`, grade: index + 1 }));
  const records = recordIds.map((id, index) => ({
    _id: objectId(id), child: children[index]._id, recordedBy: objectId(userId),
    serviceDate: new Date(`${serviceDate}T00:00:00Z`), serviceYear: 2026, status: "present",
  }));
  const state = {
    user: { _id: objectId(userId), name: "Staff", role: roles, class: assignedClass, isAccountVerified: true, tokenVersion: 0 },
    childReads: 0,
    writes: 0,
    records,
  };
  t.mock.method(User.collection, "findOne", async () => state.user);
  t.mock.method(User.collection, "find", () => ({ toArray: async () => [state.user] }));
  t.mock.method(Child.collection, "find", (filter) => {
    state.childReads++;
    return { toArray: async () => children.filter((child) => matches(child, filter)) };
  });
  t.mock.method(Child.collection, "findOne", async (filter) => {
    state.childReads++;
    return children.find((child) => matches(child, filter)) || null;
  });
  t.mock.method(Attendance.collection, "find", (filter) => ({
    toArray: async () => records.filter((record) => matches(record, filter))
      .sort((left, right) => right.serviceDate - left.serviceDate),
  }));
  t.mock.method(Attendance.collection, "findOneAndUpdate", async (filter, update) => {
    const record = records.find((item) => matches(item, filter));
    if (!record) return null;
    state.writes++;
    return { ...record, ...update.$set };
  });
  t.mock.method(Attendance.collection, "findOneAndDelete", async (filter) => {
    const record = records.find((item) => matches(item, filter));
    if (!record) return null;
    state.writes++;
    return record;
  });
  t.mock.method(Attendance, "bulkWrite", async () => { state.writes++; return {}; });

  const app = express();
  app.use(cookieParser());
  app.use("/api/attendance", attendanceRouter);
  // Current database permissions must override forged role/class claims everywhere.
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"], class: 2 }, process.env.JWT_SECRET);
  state.request = (method, path, body = {}) => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = method;
    req.url = `/api/attendance${path}`;
    req.headers = { cookie: `token=${token}` };
    req.body = { ...body, role: ["admin"], class: 2, attendanceAccess: { allClasses: true } };
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (result) => resolve({ status: res.statusCode, body: result });
    app.handle(req, res, (error) => reject(error || new Error(`Unmatched attendance route ${method} ${path}`)));
  });
  return state;
};

test("leaders receive only their class roster, dated attendance, and yearly attendance", async (t) => {
  const state = setup(t);
  const roster = await state.request("GET", "/children?grade=2&allClasses=true");
  assert.equal(roster.status, 200);
  assert.deepEqual(roster.body.access, { allClasses: false, grade: 1 });
  assert.deepEqual(roster.body.children.map((child) => String(child._id)), [childIds[0]]);
  for (const path of [`/date/${serviceDate}?class=2`, "/year/2026?allClasses=true"]) {
    const response = await state.request("GET", path);
    assert.equal(response.status, 200);
    assert.equal(response.body.count, 1);
    assert.equal(String(response.body.attendance[0].child._id), childIds[0]);
  }
  const ownHistory = await state.request("GET", `/child/${childIds[0]}?year=2026`);
  assert.equal(ownHistory.status, 200);
  assert.equal(ownHistory.body.count, 1);
  const otherHistory = await state.request("GET", `/child/${childIds[1]}`);
  assert.equal(otherHistory.status, 403);
  assert.equal(otherHistory.body.child, undefined);
  assert.equal(otherHistory.body.attendance, undefined);
});

test("absence counters use saved history and respect the leader's class access", async (t) => {
  const state = setup(t);
  state.records.forEach((record) => { record.status = "absent"; });
  let response = await state.request("GET", `/date/${serviceDate}`);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body.consecutiveAbsences), [childIds[0]]);
  assert.equal(response.body.consecutiveAbsences[childIds[0]], 1);

  state.user.role = ["admin"];
  response = await state.request("GET", `/date/${serviceDate}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.consecutiveAbsences[childIds[0]], 1);
  assert.equal(response.body.consecutiveAbsences[childIds[1]], 1);

  state.records[0].status = "present";
  response = await state.request("GET", `/date/${serviceDate}`);
  assert.equal(response.body.consecutiveAbsences[childIds[0]], 0);
  assert.equal(response.body.consecutiveAbsences[childIds[1]], 1);
});

test("leaders can record their class and mixed-class batches are rejected before any write", async (t) => {
  const state = setup(t);
  const other = await state.request("POST", "/", { child: childIds[1], serviceDate });
  assert.equal(other.status, 403);
  const mixed = await state.request("POST", "/weekly", {
    serviceDate, attendance: childIds.map((child) => ({ child, status: "present" })),
  });
  assert.equal(mixed.status, 403);
  assert.equal(state.writes, 0);
  const own = await state.request("POST", "/", { child: childIds[0], serviceDate });
  assert.equal(own.status, 200);
  const weekly = await state.request("POST", "/weekly", {
    serviceDate, attendance: [{ child: childIds[0], status: "present" }],
  });
  assert.equal(weekly.status, 200);
  assert.equal(weekly.body.count, 1, "Saving must not return other classes' attendance");
  assert.equal(String(weekly.body.attendance[0].child._id), childIds[0]);
  assert.equal(state.writes, 2);
});

test("leaders can update and delete only attendance records from their class", async (t) => {
  const state = setup(t);
  for (const method of ["PUT", "DELETE"]) {
    const before = state.writes;
    const other = await state.request(method, `/${recordIds[1]}`, { status: "absent" });
    assert.equal(other.status, 404);
    assert.equal(state.writes, before);
    assert.equal((await state.request(method, `/${recordIds[0]}`, { status: "absent" })).status, 200);
    assert.equal(state.writes, before + 1);
  }
});

test("admin, pascal, and pamela retain all-class access, including combined leader roles", async (t) => {
  const state = setup(t);
  for (const role of ["admin", "pascal", "pamela"]) {
    for (const roles of [[role], ["leader", role]]) {
      state.user.role = roles;
      state.user.class = 0;
      const roster = await state.request("GET", "/children");
      assert.equal(roster.status, 200);
      assert.equal(roster.body.access.allClasses, true);
      assert.equal(roster.body.children.length, 2);
      for (const path of [`/date/${serviceDate}`, "/year/2026"]) {
        const response = await state.request("GET", path);
        assert.equal(response.status, 200);
        assert.equal(response.body.count, 2);
      }
      assert.equal((await state.request("GET", `/child/${childIds[1]}`)).status, 200);
      assert.equal((await state.request("POST", "/", { child: childIds[1], serviceDate })).status, 200);
      const weekly = await state.request("POST", "/weekly", {
        serviceDate, attendance: childIds.map((child) => ({ child, status: "present" })),
      });
      assert.equal(weekly.status, 200);
      assert.equal(weekly.body.count, 2);
      for (const method of ["PUT", "DELETE"]) {
        assert.equal((await state.request(method, `/${recordIds[1]}`, { status: "absent" })).status, 200);
      }
    }
  }
});

test("leaders without an assigned class cannot read or write attendance", async (t) => {
  const state = setup(t);
  const routes = [
    ["GET", "/children"], ["GET", `/date/${serviceDate}`], ["GET", "/year/2026"],
    ["GET", `/child/${childIds[0]}`], ["POST", "/"], ["POST", "/weekly"],
    ["PUT", `/${recordIds[0]}`], ["DELETE", `/${recordIds[0]}`],
  ];
  for (const assignedClass of [0, undefined, null, 13]) {
    state.user.class = assignedClass;
    for (const [method, path] of routes) {
      const result = await state.request(method, path, { child: childIds[0], serviceDate });
      assert.equal(result.status, 403);
      assert.equal(result.body.code, "ATTENDANCE_CLASS_REQUIRED");
    }
  }
  assert.equal(state.childReads, 0);
  assert.equal(state.writes, 0);
});

test("attendance requests immediately follow class reassignment and role changes", async (t) => {
  const state = setup(t);
  for (const grade of [1, 2]) {
    state.user.class = grade;
    const roster = await state.request("GET", "/children");
    assert.deepEqual(roster.body.children.map((child) => child.grade), [grade]);
  }
  state.user.role = ["leader", "admin"];
  assert.equal((await state.request("GET", "/children")).body.children.length, 2);
  state.user.role = ["leader"];
  assert.deepEqual((await state.request("GET", "/children")).body.children.map((child) => child.grade), [2]);
});

test("an assigned class with no children returns no attendance and cannot mutate other records", async (t) => {
  const state = setup(t, ["leader"], 3);
  const roster = await state.request("GET", "/children");
  assert.equal(roster.status, 200);
  assert.deepEqual(roster.body.children, []);
  for (const path of [`/date/${serviceDate}`, "/year/2026"]) {
    const response = await state.request("GET", path);
    assert.equal(response.status, 200);
    assert.equal(response.body.count, 0);
    assert.deepEqual(response.body.attendance, []);
  }
  for (const method of ["PUT", "DELETE"]) {
    assert.equal((await state.request(method, `/${recordIds[0]}`, { status: "absent" })).status, 404);
  }
  assert.equal(state.writes, 0);
});
