import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Camp from "../models/campsModel.js";
import User from "../models/userModel.js";
import campRouter from "../routes/campRoutes.js";
import { toCampSummary } from "../services/campResponses.js";

const userId = "6ab26b08171afea3091f04b3";
const otherId = "6ac82222376fb9c75f5b3961";
const campId = "6ab26af3171afea3091f04af";
const missingId = "6ab26af3171afea3091f04ae";
const secret = "test-only-camp-privacy-secret";
const objectId = (id) => new mongoose.Types.ObjectId(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const summaryKeys = ["_id", "title", "name", "body", "TripType", "image", "years", "createdAt", "updatedAt", "applicantCount", "hasApplied"].sort();
const projection = (record, fields) => !fields ? record :
  Object.fromEntries(Object.entries(record).filter(([key]) =>
    Object.values(fields).includes(0) ? fields[key] !== 0 : key === "_id" || fields[key] === 1));

function setup(t) {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = secret;
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const state = {
    user: { _id: objectId(userId), name: "Viewer", email: "viewer@example.com", role: ["parent"], isAccountVerified: true, tokenVersion: 0 },
    other: { _id: objectId(otherId), name: "Private participant", email: "private@example.com", role: ["parent"], password: "private-hash", phone: "private-phone", emailJobs: { welcome: { text: "private-code" } } },
    camp: {
      _id: objectId(campId), title: "Trip", name: "Trip team", body: "Public description", TripType: "Trip", image: "", years: [1, 2],
      createdBy: objectId(otherId), createdAt: new Date("2026-10-15T00:00:00Z"), updatedAt: new Date("2026-10-15T00:00:00Z"),
      applicants: [{ _id: objectId(missingId), user: objectId(otherId), appliedAt: new Date("2026-10-14T00:00:00Z"), notes: "private-note", parentPhone: "private-phone" }],
      internalEmail: "private@example.com", futurePrivateField: "private-extra", __v: 0,
    },
    pipelines: [], campReads: [], populations: 0, writes: 0,
    roleLookupError: false, missingRoleUser: false,
  };
  t.mock.method(User.collection, "findOne", async (filter, options) => {
    assert.equal(String(filter._id), userId);
    if (options?.projection?.role) {
      if (state.roleLookupError) throw new Error("Private role lookup details");
      if (state.missingRoleUser) return null;
    }
    return state.user ? projection(state.user, options?.projection) : null;
  });
  // Mongoose still constructs the population query and limits user fields.
  t.mock.method(User.collection, "find", (filter, options) => {
    state.populations++;
    assert.deepEqual(options.projection, { name: 1, email: 1, role: 1 });
    const users = [state.user, state.other].filter((user) => user && filter._id.$in.some((id) => String(id) === String(user._id)));
    return { toArray: async () => users.map((user) => projection(user, options.projection)) };
  });
  t.mock.method(Camp.collection, "aggregate", (pipeline) => {
    state.pipelines.push(pipeline);
    const fields = pipeline.at(-1).$project;
    assert.deepEqual(Object.keys(fields).sort(), summaryKeys, "Only public metadata and computed membership may leave MongoDB");
    assert.deepEqual(fields.applicantCount, { $size: { $ifNull: ["$applicants", []] } });
    assert.equal(String(fields.hasApplied.$in[0]), userId, "Only the authenticated viewer's status may be computed");
    assert.deepEqual(fields.hasApplied.$in[1], { $ifNull: ["$applicants.user", []] });
    const match = pipeline[0].$match;
    const camp = state.camp;
    const matches = camp && (!match._id || String(match._id) === String(camp._id)) &&
      (!match.years || camp.years.includes(match.years)) && (!match.TripType || match.TripType === camp.TripType) &&
      (!match.$or || match.$or.some((part) => Object.entries(part).some(([key, condition]) => new RegExp(condition.$regex, condition.$options).test(camp[key]))));
    // Emulate just the projected MongoDB result; document the DB-I/O boundary.
    const records = matches ? [{
      ...projection(camp, fields),
      applicantCount: camp.applicants?.length || 0,
      hasApplied: camp.applicants?.some((applicant) => String(applicant.user) === userId) || false,
    }] : [];
    return { toArray: async () => records };
  });
  t.mock.method(Camp.collection, "findOne", async (filter, options) => {
    state.campReads.push({ filter, options });
    return state.camp && String(filter._id) === String(state.camp._id) ? projection(state.camp, options?.projection) : null;
  });
  t.mock.method(Camp.collection, "updateOne", async (filter, update) => {
    assert.equal(String(filter._id), campId);
    if (update.$push?.applicants) state.camp.applicants.push(...update.$push.applicants.$each);
    Object.assign(state.camp, update.$set);
    state.writes++;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  t.mock.method(Camp.collection, "findOneAndUpdate", async (filter, update, options) => {
    assert.equal(options.returnDocument, "after");
    assert.equal(String(filter._id), campId);
    if (!state.camp) return null;
    Object.assign(state.camp, update.$set);
    state.writes++;
    return state.camp;
  });
  t.mock.method(Camp.collection, "insertOne", async (record) => {
    state.writes++;
    state.camp = record;
    return { acknowledged: true, insertedId: record._id };
  });
  const app = express();
  app.use(cookieParser());
  app.use("/api/camps", campRouter);
  // Forged claims and request fields must never grant roster access or select
  // whose registration status is returned.
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"] }, secret, { expiresIn: "1h" });
  state.request = (method = "GET", path = "", body = {}, requestToken = token) => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = method;
    req.url = `/api/camps${path}`;
    req.headers = requestToken ? { cookie: `token=${requestToken}` } : {};
    req.body = { ...body, userId: otherId, role: ["admin"], user: { role: ["admin"] } };
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (result) => resolve({ status: res.statusCode, body: clone(result), headers });
    app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
  });
  return state;
}

const assertSummary = (camp, count = 1, applied = false) => {
  assert.deepEqual(Object.keys(camp).sort(), summaryKeys);
  assert.equal(camp.applicantCount, count);
  assert.equal(camp.hasApplied, applied);
  const text = JSON.stringify(camp);
  for (const forbidden of [otherId, "private@example.com", "private-phone", "private-note", "private-extra", "private-hash", "applicants", "createdBy", "role"]) {
    assert.equal(text.includes(forbidden), false, `Summary leaked ${forbidden}`);
  }
};

test("unrelated members receive only counts and their own status from camp lists and details", async (t) => {
  const state = setup(t);
  for (const role of ["parent", "unAssigned", "admin", "leader", "pascal", "pamela"]) {
    state.user.role = [role];
    const list = await state.request("GET", `?userId=${otherId}&role=admin&populate=applicants.user`);
    const detail = await state.request("GET", `/${campId}?userId=${otherId}&populate=createdBy`);
    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assertSummary(list.body.camps[0]);
    assertSummary(detail.body.camp);
    assert.equal(detail.headers.get("cache-control"), "private, no-store");
  }
  assert.equal(state.populations, 0);
  assert.equal(state.campReads.length, 0, "Member reads never retrieve the full roster");
});

test("registration status handles the viewer's membership, no applicants, and legacy missing arrays", async (t) => {
  const state = setup(t);
  state.camp.applicants.push({ user: objectId(userId), appliedAt: new Date() });
  assertSummary((await state.request("GET", `/${campId}`)).body.camp, 2, true);
  state.camp.applicants = [];
  assertSummary((await state.request()).body.camps[0], 0, false);
  delete state.camp.applicants;
  assertSummary((await state.request()).body.camps[0], 0, false);
});

test("applying and withdrawing return safe updated summaries while retaining other applications", async (t) => {
  const state = setup(t);
  const application = { applicationType: "parent_for_child", childName: "Viewer child", childYear: 2, parentPhone: "123" };
  const applied = await state.request("POST", `/${campId}/apply`, application);
  assert.equal(applied.status, 200);
  assertSummary(applied.body.camp, 2, true);
  assert.equal(String(state.camp.applicants.at(-1).user), userId);
  assert.equal((await state.request("POST", `/${campId}/apply`, application)).status, 400);
  const withdrawn = await state.request("DELETE", `/${campId}/apply`);
  assert.equal(withdrawn.status, 200);
  assertSummary(withdrawn.body.camp, 1, false);
  assert.equal(String(state.camp.applicants[0].user), otherId);
  assert.equal((await state.request("DELETE", `/${campId}/apply`)).status, 400);
  assert.equal(state.writes, 2);
});

test("ordinary members cannot retrieve rosters even with forged admin claims", async (t) => {
  const state = setup(t);
  for (const roles of [["parent"], ["unAssigned"], [], ["parent", "unknown"]]) {
    state.user.role = roles;
    const result = await state.request("GET", `/${campId}/applicants?role=admin`);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "STAFF_ACCESS_REQUIRED");
    assert.equal(result.body.applicants, undefined);
  }
  assert.equal(state.populations, 0);
  assert.equal(state.campReads.length, 0, "Denied roster requests stop before camp I/O");
});

test("all existing staff roles can read a separately projected applicant roster", async (t) => {
  const state = setup(t);
  for (const role of ["admin", "leader", "pascal", "pamela"]) {
    state.user.role = [role];
    const result = await state.request("GET", `/${campId}/applicants`);
    assert.equal(result.status, 200);
    assert.equal(result.body.applicantCount, 1);
    assert.equal(result.body.campId, campId);
    assert.deepEqual(result.body.applicants[0].user, { _id: otherId, name: state.other.name, email: state.other.email, role: ["parent"] });
    assert.deepEqual(Object.keys(result.body.applicants[0]).sort(), ["_id", "appliedAt", "user"]);
    assert.deepEqual(state.campReads.at(-1).options.projection, { applicants: 1 });
    assert.equal(JSON.stringify(result.body).includes("private-hash"), false);
    assert.equal(JSON.stringify(result.body).includes("private-phone"), false);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
  }
});

test("staff roster access follows current roles and fails closed when authorization is unavailable", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  assert.equal((await state.request("GET", `/${campId}/applicants`)).status, 200);
  const reads = state.campReads.length;
  state.user.role = ["parent"];
  assert.equal((await state.request("GET", `/${campId}/applicants`)).status, 403);
  state.missingRoleUser = true;
  assert.equal((await state.request("GET", `/${campId}/applicants`)).status, 401);
  state.missingRoleUser = false;
  state.roleLookupError = true;
  const failed = await state.request("GET", `/${campId}/applicants`);
  assert.equal(failed.status, 500);
  assert.equal(JSON.stringify(failed.body).includes("Private"), false);
  assert.equal(state.campReads.length, reads);
});

test("unverified, anonymous, deleted, and revoked accounts cannot read camp metadata or rosters", async (t) => {
  const state = setup(t);
  for (const path of ["", `/${campId}`, `/${campId}/applicants`]) {
    assert.equal((await state.request("GET", path, {}, null)).status, 401);
    state.user.isAccountVerified = false;
    assert.equal((await state.request("GET", path)).status, 403);
    state.user.isAccountVerified = true;
    state.user.tokenVersion = 1;
    assert.equal((await state.request("GET", path)).status, 401);
    state.user.tokenVersion = 0;
  }
  state.user = null;
  assert.equal((await state.request()).status, 401);
  assert.equal(state.pipelines.length, 0);
  assert.equal(state.campReads.length, 0);
});

test("staff creation and update responses use the same safe camp summary", async (t) => {
  const state = setup(t);
  state.user.role = ["leader"];
  const updated = await state.request("PUT", `/${campId}`, { title: "Updated trip", applicants: [], createdBy: userId });
  assert.equal(updated.status, 200);
  assertSummary(updated.body.camp);
  assert.equal(updated.body.camp.title, "Updated trip");
  assert.equal(state.camp.applicants.length, 1);
  state.user.role = ["parent"];
  assert.equal((await state.request("PUT", `/${campId}`, { title: "Unauthorized" })).status, 403);
  state.user.role = ["admin"];
  const created = await state.request("POST", "", { title: "New trip", name: "Team", body: "Description", years: [1], TripType: "Trip", applicants: [{ user: otherId }] });
  assert.equal(created.status, 201);
  assertSummary(created.body.camp, 0, false);
});

test("missing camps, invalid IDs, and safe list filters retain useful responses", async (t) => {
  const state = setup(t);
  assert.equal((await state.request("GET", "/invalid")).status, 400);
  assert.equal((await state.request("GET", `/${missingId}`)).status, 404);
  state.user.role = ["admin"];
  assert.equal((await state.request("GET", "/invalid/applicants")).status, 400);
  assert.equal((await state.request("GET", `/${missingId}/applicants`)).status, 404);
  assert.equal((await state.request("GET", "?search=Trip&year=1&tripType=Trip")).body.camps.length, 1);
  assert.equal((await state.request("GET", "?search=.*")).body.camps.length, 0, "Search metacharacters are literal");
  for (const query of ["?year=13", "?year=1&year=2", "?tripType=invalid", `?search=${"x".repeat(201)}`]) {
    assert.equal((await state.request("GET", query)).status, 400);
  }
});

test("deleted applicant accounts do not break the private roster", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  state.other = null;
  const result = await state.request("GET", `/${campId}/applicants`);
  assert.equal(result.status, 200);
  assert.equal(result.body.applicantCount, 1);
  assert.equal(result.body.applicants[0].user, null);
  state.camp.applicants = null;
  const empty = await state.request("GET", `/${campId}/applicants`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.applicantCount, 0);
  assert.deepEqual(empty.body.applicants, []);
});

test("failed camp reads return generic errors without partial roster or internal details", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  t.mock.method(console, "error", () => {});
  t.mock.method(Camp.collection, "aggregate", () => { throw new Error("private@example.com database details"); });
  t.mock.method(Camp.collection, "findOne", () => { throw new Error("private@example.com database details"); });
  for (const path of ["", `/${campId}`, `/${campId}/applicants`]) {
    const result = await state.request("GET", path);
    assert.equal(result.status, 500);
    assert.equal(JSON.stringify(result.body).includes("private@example.com"), false);
    assert.equal(result.body.camp, undefined);
    assert.equal(result.body.applicants, undefined);
  }
});

test("camp summary allowlists also withstand populated documents and future private fields", () => {
  const camp = {
    _id: campId, title: "Trip", createdBy: { _id: otherId, email: "private@example.com", role: ["admin"] },
    applicants: [{ user: { _id: userId, email: "viewer@example.com", role: ["parent"] } }],
    futurePrivateField: "private-note",
  };
  assert.deepEqual(toCampSummary(camp, userId), { _id: campId, title: "Trip", applicantCount: 1, hasApplied: true });
});
