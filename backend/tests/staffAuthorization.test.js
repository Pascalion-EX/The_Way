import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import childProfileRouter from "../routes/childProfileRoutes.js";
import attendanceRouter from "../routes/attendanceRoutes.js";
import notificationRouter from "../routes/notificationRoutes.js";
import { requireStaff } from "../middleware/staffAuth.js";
import User from "../models/userModel.js";
import Child from "../models/childProfileModel.js";
import Attendance from "../models/attendanceModel.js";
import Notification from "../models/notificationModel.js";

const userId = "6ab26b08171afea3091f04b3";
const childId = "6ac82222376fb9c75f5b3961";
const recordId = "6ab26af3171afea3091f04af";
const jwtSecret = "test-only-staff-authorization-secret";
const objectId = (id) => new mongoose.Types.ObjectId(id);

const childRoutes = [
  ["GET", "/", undefined, 200],
  ["POST", "/", { name: "Synthetic child", grade: 1 }, 201],
  ["GET", `/${childId}`, undefined, 200],
  ["GET", "/grade/1", undefined, 200],
  ["PUT", `/${childId}`, { name: "Updated child", grade: 2 }, 200],
  ["DELETE", `/${childId}`, undefined, 200],
];

const protectedRoutes = [
  ...["/api/children", "/api/childProfile"].flatMap((prefix) =>
    childRoutes.map(([method, path, body, status]) => ({ method, path: prefix + path, body, status }))
  ),
  { method: "POST", path: "/api/attendance/", body: { child: childId, serviceDate: "2026-10-14" }, status: 200 },
  { method: "POST", path: "/api/attendance/weekly", body: { serviceDate: "2026-10-14", attendance: [{ child: childId, status: "present" }] }, status: 200 },
  { method: "GET", path: "/api/attendance/date/2026-10-14", status: 200 },
  { method: "GET", path: `/api/attendance/child/${childId}`, status: 200 },
  { method: "GET", path: "/api/attendance/year/2026", status: 200 },
  { method: "PUT", path: `/api/attendance/${recordId}`, body: { status: "absent" }, status: 200 },
  { method: "DELETE", path: `/api/attendance/${recordId}`, status: 200 },
  { method: "POST", path: "/api/notifications/", body: { title: "Staff notice", url: "/", targetRoles: ["admin"] }, status: 201 },
  { method: "POST", path: "/api/notifications/role/admin", body: { title: "Staff notice", url: "/" }, status: 201 },
  { method: "PUT", path: "/api/notifications/clear/roles", body: { targetRoles: ["admin"] }, status: 200 },
  { method: "DELETE", path: `/api/notifications/${recordId}`, status: 200 },
];

const createApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use("/api/children", childProfileRouter);
  app.use("/api/childProfile", childProfileRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/notifications", notificationRouter);
  return app;
};

// Exercise Express's actual routing and middleware without opening a listener.
const request = (app, route, token) => new Promise((resolve, reject) => {
  const req = Readable.from([]);
  req.method = route.method;
  req.url = route.path;
  req.headers = token ? { cookie: `token=${token}` } : {};
  req.body = { ...route.body, role: ["admin"], userId };
  req.socket = {};
  req.connection = req.socket;
  const res = Object.create(express.response);
  const headers = new Map();
  res.statusCode = 200;
  res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
  res.getHeader = (name) => headers.get(name.toLowerCase());
  res.json = (body) => resolve({ status: res.statusCode, body });
  app.handle(req, res, (error) => reject(error || new Error(`Unmatched route: ${route.method} ${route.path}`)));
});

const stubDatabase = (t) => {
  const state = {
    user: { _id: objectId(userId), name: "Synthetic staff", role: ["admin"], isAccountVerified: true },
    authorizationError: false,
    reads: 0,
    businessCalls: 0,
  };
  t.mock.method(User.collection, "findOne", async (filter, options) => {
    assert.equal(String(filter._id), userId);
    state.reads++;
    if (state.authorizationError && options?.projection?.role) {
      throw new Error("Synthetic database outage with internal details");
    }
    return state.user;
  });
  t.mock.method(User.collection, "find", () => ({ toArray: async () => state.user ? [state.user] : [] }));

  const child = { _id: objectId(childId), name: "Synthetic child", grade: 1, address: "Private address" };
  const attendance = {
    _id: objectId(recordId), child: objectId(childId), recordedBy: objectId(userId),
    serviceDate: new Date("2026-10-14T00:00:00Z"), serviceYear: 2026, status: "present",
  };
  const notification = () => ({
    _id: objectId(recordId), title: "Synthetic notice", url: "/", seenBy: [],
    targetRoles: [state.user?.role?.includes("unAssigned") ? "unAssined" : "parent", "admin"],
  });
  for (const [model, record] of [[Child, () => child], [Attendance, () => attendance], [Notification, notification]]) {
    const call = (value) => { state.businessCalls++; return value; };
    t.mock.method(model.collection, "find", () => call({ toArray: async () => [record()] }));
    t.mock.method(model.collection, "findOne", async () => call(record()));
    t.mock.method(model.collection, "findOneAndUpdate", async () => call(record()));
    t.mock.method(model.collection, "findOneAndDelete", async () => call(record()));
    t.mock.method(model.collection, "insertOne", async (document) => call({ acknowledged: true, insertedId: document._id }));
    t.mock.method(model.collection, "updateOne", async () => call({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
    t.mock.method(model.collection, "updateMany", async () => call({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }));
    t.mock.method(model.collection, "deleteOne", async () => call({ acknowledged: true, deletedCount: 1 }));
    t.mock.method(model.collection, "bulkWrite", async () => call({ acknowledged: true, upsertedCount: 1 }));
  }

  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = jwtSecret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  // Forged staff claims in a valid token and request body must not grant permission.
  state.token = jwt.sign({ id: userId, role: ["admin"] }, jwtSecret, { expiresIn: "1h" });
  return state;
};

test("every child alias, attendance route, and notification mutation rejects unauthorized users before business I/O", async (t) => {
  const state = stubDatabase(t);
  const app = createApp();
  for (const identity of [
    { name: "anonymous", token: undefined, status: 401 },
    { name: "invalid token", token: "invalid", status: 401 },
    { name: "expired token", token: jwt.sign({ id: userId }, jwtSecret, { expiresIn: -1 }), status: 401 },
    { name: "deleted account", token: state.token, user: null, status: 401 },
    { name: "unverified staff", token: state.token, role: ["admin"], verified: false, status: 403 },
    { name: "default verified user", token: state.token, role: ["unAssigned"], status: 403 },
    { name: "verified parent", token: state.token, role: ["parent"], status: 403 },
    { name: "empty role", token: state.token, role: [], status: 403 },
    { name: "unknown role", token: state.token, role: ["administrator"], status: 403 },
  ]) {
    state.user = identity.user === null ? null : {
      _id: objectId(userId), role: identity.role || ["admin"], isAccountVerified: identity.verified ?? true,
    };
    for (const route of protectedRoutes) {
      const result = await request(app, route, identity.token);
      assert.equal(result.status, identity.status, `${identity.name}: ${route.method} ${route.path}`);
      assert.equal(result.body.success, false);
      if (identity.name === "unverified staff") assert.equal(result.body.code, "EMAIL_VERIFICATION_REQUIRED");
      if (["default verified user", "verified parent", "empty role", "unknown role"].includes(identity.name)) {
        assert.equal(result.body.code, "STAFF_ACCESS_REQUIRED");
      }
      assert.equal(state.businessCalls, 0, "Denied requests must not read or write protected documents");
    }
  }
});

test("all four verified staff roles retain access to every protected route", async (t) => {
  const state = stubDatabase(t);
  const app = createApp();
  for (const role of ["admin", "leader", "pascal", "pamela"]) {
    state.user.role = ["parent", role];
    for (const route of protectedRoutes) {
      const before = state.businessCalls;
      const result = await request(app, route, state.token);
      assert.equal(result.status, route.status, `${role}: ${route.method} ${route.path}`);
      assert.equal(result.body.success, true);
      assert.ok(state.businessCalls > before, "Authorized request should reach its real controller");
    }
  }
});

test("verified non-staff users can read their notifications and mark them seen", async (t) => {
  const state = stubDatabase(t);
  const app = createApp();
  for (const role of ["parent", "unAssigned"]) {
    state.user.role = [role];
    for (const route of [
      { method: "GET", path: "/api/notifications/" },
      { method: "GET", path: "/api/notifications/unseen" },
      { method: "PUT", path: `/api/notifications/${recordId}/seen` },
      { method: "PUT", path: "/api/notifications/seen/all" },
    ]) {
      const result = await request(app, route, state.token);
      assert.equal(result.status, 200, `${role}: ${route.method} ${route.path}`);
      assert.equal(result.body.success, true);
    }
  }
});

test("staff authorization uses current database roles and fails closed on lookup errors", async (t) => {
  const state = stubDatabase(t);
  const app = createApp();
  const route = protectedRoutes[0];
  assert.equal((await request(app, route, state.token)).status, 200);
  state.user.role = ["parent"];
  const before = state.businessCalls;
  assert.equal((await request(app, route, state.token)).status, 403);
  assert.equal(state.businessCalls, before, "A still-valid staff JWT must not bypass role revocation");
  state.authorizationError = true;
  const result = await request(app, route, state.token);
  assert.equal(result.status, 500);
  assert.equal(result.body.message, "Unable to check staff permissions.");
  assert.equal(state.businessCalls, before);
});

test("shared staff middleware fails closed without authentication or verification", async (t) => {
  const state = stubDatabase(t);
  const response = () => ({
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  for (const authenticated of [false, true]) {
    state.user.isAccountVerified = false;
    const res = response();
    let granted = false;
    await requireStaff(authenticated ? { userId } : {}, res, () => { granted = true; });
    assert.equal(res.statusCode, authenticated ? 403 : 401);
    assert.equal(granted, false);
  }
});
