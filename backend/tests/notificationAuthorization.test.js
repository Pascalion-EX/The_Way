import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import notificationRouter from "../routes/notificationRoutes.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";

const userId = "6ab26b08171afea3091f04b3";
const otherUserId = "6ac82222376fb9c75f5b3961";
const notificationId = "6ab26af3171afea3091f04af";
const missingId = "6ab26af3171afea3091f04ae";
const jwtSecret = "test-only-notification-authorization-secret";
const objectId = (id) => new mongoose.Types.ObjectId(id);

const setup = (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = jwtSecret;
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });

  const state = {
    user: { _id: objectId(userId), role: ["parent"], isAccountVerified: true },
    notification: {
      _id: objectId(notificationId), title: "Private staff notice",
      message: "Staff-only contents", url: "/staff", targetRoles: ["admin"], seenBy: [],
    },
    roleLookupMissing: false,
    roleLookupError: false,
    writes: 0,
  };
  t.mock.method(User.collection, "findOne", async (filter, options) => {
    assert.equal(String(filter._id), userId);
    if (options?.projection?.role) {
      if (state.roleLookupError) throw new Error("Private database details");
      if (state.roleLookupMissing) return null;
    }
    return state.user;
  });
  // Keep real Mongoose sanitization/casting; emulate only the MongoDB collection.
  state.update = t.mock.method(Notification.collection, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(options.returnDocument, "after");
    assert.equal(options.upsert, undefined);
    const record = state.notification;
    if (!record || String(filter._id) !== String(record._id)) return null;
    if (!filter.targetRoles?.$in?.some((role) => record.targetRoles.includes(role))) return null;
    assert.equal(String(update.$addToSet.seenBy), userId);
    if (!record.seenBy.some((id) => String(id) === userId)) {
      record.seenBy.push(update.$addToSet.seenBy);
      state.writes++;
    }
    return { ...record, seenBy: [...record.seenBy] };
  });
  t.mock.method(Notification.collection, "findOne", () => assert.fail("Unscoped notification lookup"));
  t.mock.method(Notification.collection, "updateOne", () => assert.fail("Non-atomic notification update"));

  const app = express();
  app.use(cookieParser());
  app.use("/api/notifications", notificationRouter);
  // Forged roles in the signed token and body must not override database roles.
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"] }, jwtSecret, { expiresIn: "1h" });
  state.request = (id = notificationId, requestToken = token) => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = "PUT";
    req.url = `/api/notifications/${id}/seen`;
    req.headers = requestToken ? { cookie: `token=${requestToken}` } : {};
    req.body = { userId: otherUserId, role: ["admin"], targetRoles: ["admin"] };
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (body) => resolve({ status: res.statusCode, body });
    app.handle(req, res, (error) => reject(error || new Error("Unmatched route")));
  });
  return state;
};

test("mark-as-seen hides other roles' notifications, even with forged roles or an existing seen entry", async (t) => {
  const state = setup(t);
  for (const identity of [
    { roles: ["parent"], targetRoles: ["admin"] },
    { roles: ["admin"], targetRoles: ["parent"] },
    { roles: [], targetRoles: ["admin"] },
    { roles: ["parent"], targetRoles: [] },
    { roles: ["parent"], targetRoles: ["admin"], seenBy: [objectId(userId)] },
  ]) {
    state.user.role = identity.roles;
    state.notification.targetRoles = identity.targetRoles;
    state.notification.seenBy = identity.seenBy || [];
    const before = [...state.notification.seenBy];
    const denied = await state.request();
    const missing = await state.request(missingId);
    assert.equal(denied.status, 404);
    assert.deepEqual(denied, missing);
    assert.deepEqual(denied.body, { success: false, message: "Notification not found" });
    assert.deepEqual(state.notification.seenBy, before);
    assert.equal(state.writes, 0);
  }
});

test("mark-as-seen permits any matching normalized role and stays idempotent under concurrent requests", async (t) => {
  const state = setup(t);
  for (const identity of [
    { roles: ["parent"], targetRoles: ["admin", "parent"] },
    { roles: ["parent", "leader"], targetRoles: ["leader"] },
    { roles: ["unAssigned"], targetRoles: ["unAssined"] },
    { roles: [" PAMELA "], targetRoles: ["pamela"] },
  ]) {
    state.user.role = identity.roles;
    state.notification.targetRoles = identity.targetRoles;
    state.notification.seenBy = [objectId(otherUserId)];
    state.writes = 0;
    const responses = await Promise.all([state.request(), state.request(), state.request()]);
    for (const result of responses) {
      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.equal(result.body.notification.message, "Staff-only contents");
      assert.equal(result.body.notification.isSeen, true);
      assert.deepEqual(result.body.notification.seenBy.map(String), [otherUserId, userId]);
    }
    assert.equal(state.writes, 1);
  }
});

test("mark-as-seen uses current database roles after access is revoked", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  assert.equal((await state.request()).status, 200);
  state.user.role = ["parent"];
  const result = await state.request();
  assert.equal(result.status, 404);
  assert.equal(result.body.notification, undefined);
  assert.equal(state.writes, 1);
});

test("mark-as-seen fails before notification I/O for invalid IDs, unauthenticated users, and missing role lookups", async (t) => {
  const state = setup(t);
  assert.equal((await state.request("invalid")).status, 400);
  assert.equal((await state.request(notificationId, null)).status, 401);
  state.user.isAccountVerified = false;
  assert.equal((await state.request()).status, 403);
  state.user.isAccountVerified = true;
  state.roleLookupMissing = true;
  assert.equal((await state.request()).status, 404);
  state.roleLookupMissing = false;
  state.roleLookupError = true;
  t.mock.method(console, "error", () => {});
  const result = await state.request();
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { success: false, message: "Failed to mark notification as seen" });
  assert.equal(state.update.mock.callCount(), 0);
  assert.equal(state.writes, 0);
});
