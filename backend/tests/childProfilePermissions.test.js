import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import childProfileRouter from "../routes/childProfileRoutes.js";
import User from "../models/userModel.js";
import Child from "../models/childProfileModel.js";
import { canAccessChildrenProfiles, canManageChildrenProfiles } from "../../shared/pageAccess.mjs";

const userId = "6ab26b08171afea3091f04b3";
const otherId = "6ab26b08171afea3091f04b4";
const ownChildId = "6ac82222376fb9c75f5b3961";
const otherChildId = "6ac82222376fb9c75f5b3962";
const legacyChildId = "6ac82222376fb9c75f5b3963";
const objectId = (id) => new mongoose.Types.ObjectId(id);
const prefixes = ["/api/children", "/api/childProfile"];

function setup(t) {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  const secret = "test-only-child-profile-permissions-secret";
  process.env.JWT_SECRET = secret;
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const state = {
    user: { _id: objectId(userId), role: ["parent"], tokenVersion: 0, isAccountVerified: true },
    children: [
      { _id: objectId(ownChildId), name: "Own child", grade: 2, createdBy: objectId(userId) },
      { _id: objectId(otherChildId), name: "Other child", grade: 2, createdBy: objectId(otherId) },
      { _id: objectId(legacyChildId), name: "Legacy child", grade: 3 },
    ],
    reads: 0,
    writes: 0,
  };
  const matches = (document, filter) => Object.entries(filter).every(([key, value]) => String(document[key]) === String(value));
  t.mock.method(User.collection, "findOne", async () => state.user);
  t.mock.method(Child.collection, "find", (filter) => {
    state.reads++;
    return { toArray: async () => state.children.filter((child) => matches(child, filter)) };
  });
  t.mock.method(Child.collection, "findOne", async (filter) => {
    state.reads++;
    return state.children.find((child) => matches(child, filter)) || null;
  });
  t.mock.method(Child.collection, "insertOne", async (document) => {
    state.writes++;
    state.children.push(document);
    return { acknowledged: true, insertedId: document._id };
  });
  for (const method of ["findOneAndUpdate", "findOneAndDelete"]) {
    t.mock.method(Child.collection, method, async () => {
      state.writes++;
      assert.fail("Parent reached a child edit or delete operation");
    });
  }

  const app = express();
  app.use(cookieParser());
  for (const prefix of prefixes) app.use(prefix, childProfileRouter);
  // Forged manager claims must not bypass the current account's role.
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["pascal"] }, secret, { expiresIn: "1h" });
  state.request = (method, path, body = {}) => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = method;
    req.url = path;
    req.headers = { cookie: `token=${token}` };
    req.body = { role: ["pascal"], userId: otherId, ...body };
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (key, value) => headers.set(key.toLowerCase(), value);
    res.getHeader = (key) => headers.get(key.toLowerCase());
    res.json = (result) => resolve({ status: res.statusCode, body: result });
    app.handle(req, res, (error) => reject(error || new Error(`Unmatched route: ${method} ${path}`)));
  });
  return state;
}

test("parents can create children through both aliases and cannot forge profile ownership", async (t) => {
  const state = setup(t);
  for (const prefix of prefixes) {
    const result = await state.request("POST", prefix, {
      name: "New child", grade: 1, firstParentJob: "Teacher", createdBy: otherId,
    });
    assert.equal(result.status, 201);
    assert.equal(String(result.body.childProfile.createdBy), userId);
    assert.equal(result.body.childProfile.firstParentJob, "Teacher");
    const loaded = await state.request("GET", `${prefix}/${result.body.childProfile._id}`);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.childProfile.name, "New child");
  }
  assert.equal(state.writes, 2);
});

test("parent lists, grade filters, and direct lookups expose only their own children", async (t) => {
  const state = setup(t);
  for (const prefix of prefixes) {
    for (const suffix of ["", "?createdBy=" + otherId, "/grade/2"]) {
      const result = await state.request("GET", prefix + suffix);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.children.map((child) => String(child._id)), [ownChildId]);
    }
    const empty = await state.request("GET", `${prefix}/grade/3`);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.children, []);
    for (const id of [otherChildId, legacyChildId]) {
      const result = await state.request("GET", `${prefix}/${id}`);
      assert.equal(result.status, 404);
      assert.equal(result.body.childProfile, undefined);
    }
  }
});

test("parents cannot edit or delete any child, including their own and newly created profiles", async (t) => {
  const state = setup(t);
  const created = await state.request("POST", prefixes[0], { name: "New child", grade: 1 });
  const reads = state.reads;
  const writes = state.writes;
  for (const role of [["parent"], ["parent", "admin"], ["parent", "leader"]]) {
    state.user.role = role;
    for (const prefix of prefixes) {
      for (const method of ["PUT", "DELETE"]) {
        for (const id of [ownChildId, otherChildId, legacyChildId, String(created.body.childProfile._id)]) {
          const result = await state.request(method, `${prefix}/${id}`, { name: "Changed", createdBy: userId });
          assert.equal(result.status, 403, `${role}: ${method} ${prefix}/${id}`);
          assert.equal(result.body.code, "CHILD_PROFILE_ACCESS_REQUIRED");
        }
      }
    }
  }
  assert.equal(state.reads, reads, "Denied mutations must not load child records");
  assert.equal(state.writes, writes, "Denied mutations must not write child records");
});

test("Pascal and Pamela retain access to all children including legacy profiles", async (t) => {
  const state = setup(t);
  for (const role of [["pascal"], ["pamela"], ["parent", "pascal"], ["parent", "pamela"]]) {
    state.user.role = role;
    for (const prefix of prefixes) {
      const result = await state.request("GET", prefix);
      assert.equal(result.status, 200);
      assert.equal(result.body.children.length, 3);
      assert.equal((await state.request("GET", `${prefix}/${legacyChildId}`)).status, 200);
    }
  }
});

test("parent access requires current verified parent permissions", async (t) => {
  const state = setup(t);
  assert.equal((await state.request("GET", prefixes[0])).status, 200);
  const reads = state.reads;
  state.user.isAccountVerified = false;
  assert.equal((await state.request("POST", prefixes[0], { name: "Child", grade: 1 })).status, 403);
  state.user.isAccountVerified = true;
  state.user.role = ["unAssigned"];
  assert.equal((await state.request("GET", prefixes[0])).status, 403);
  assert.equal(state.reads, reads);
  assert.equal(state.writes, 0);
});

test("shared permissions separate parent creation access from profile management", () => {
  for (const roles of ["parent", ["parent"], ["parent", "leader"]]) {
    assert.equal(canAccessChildrenProfiles(roles), true);
    assert.equal(canManageChildrenProfiles(roles), false);
  }
  for (const roles of ["pascal", "pamela", ["parent", "pascal"]]) {
    assert.equal(canAccessChildrenProfiles(roles), true);
    assert.equal(canManageChildrenProfiles(roles), true);
  }
  for (const roles of [undefined, [], "unAssigned", "admin", "leader"]) {
    assert.equal(canAccessChildrenProfiles(roles), false);
    assert.equal(canManageChildrenProfiles(roles), false);
  }
});
