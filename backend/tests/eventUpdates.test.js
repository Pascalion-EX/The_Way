import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Event from "../models/EventModel.js";
import User from "../models/userModel.js";
import eventRouter from "../routes/eventRoutes.js";
import { EVENT_TYPES, validateEventUpdate } from "../services/eventValidation.js";

const userId = "6ab26b08171afea3091f04b3";
const ownerId = "6ac82222376fb9c75f5b3961";
const eventId = "6ab26af3171afea3091f04af";
const missingId = "6ab26af3171afea3091f04ae";
const secret = "test-only-event-update-secret";
const objectId = (id) => new mongoose.Types.ObjectId(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const protectedFields = ["_id", "createdBy", "source", "calendarKey", "generatedYear", "createdAt", "__v"];
const metadata = (event) => clone(Object.fromEntries(protectedFields.map((key) => [key, event[key]])));
const sameDate = (left, right) => left == null && right == null || Number(new Date(left)) === Number(new Date(right));

function setup(t) {
  const oldSecret = process.env.JWT_SECRET;
  const oldSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = secret;
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    mongoose.set("sanitizeFilter", oldSanitizer);
  });
  const state = {
    user: { _id: objectId(userId), role: ["leader"], tokenVersion: 0, isAccountVerified: true },
    event: {
      _id: objectId(eventId), title: "Original", description: "Original description", eventType: "Meeting", location: "Church", years: [1, 2], allDay: false,
      startDate: new Date("2026-10-15T10:00:00Z"), endDate: new Date("2026-10-15T12:00:00Z"),
      createdBy: objectId(ownerId), source: "coptic-calendar", calendarKey: "coptic:2026:test", generatedYear: 2026,
      createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), __v: 7,
    },
    reads: 0, writes: 0, writeError: null, roleError: false, missingRoleUser: false, race: null,
  };
  t.mock.method(User.collection, "findOne", async (filter, options) => {
    assert.equal(String(filter._id), userId);
    if (!options?.projection) {
      if (state.roleError) throw new Error("Private permission lookup details");
      if (state.missingRoleUser) return null;
    }
    return state.user;
  });
  t.mock.method(Event.collection, "findOne", async (filter, options) => {
    state.reads++;
    assert.deepEqual(options.projection, { startDate: 1, endDate: 1 });
    return state.event && String(filter._id) === String(state.event._id) ? state.event : null;
  });
  state.write = t.mock.method(Event.collection, "findOneAndUpdate", async (filter, update, options) => {
    if (state.writeError) throw state.writeError;
    if (state.race) state.race();
    assert.equal(options.returnDocument, "after");
    assert.equal(options.upsert, false);
    assert.deepEqual(Object.keys(update), ["$set"], "Only the server-constructed set may reach MongoDB");
    for (const key of Object.keys(update.$set)) {
      assert.ok(["title", "description", "eventType", "startDate", "endDate", "allDay", "location", "years", "updatedAt"].includes(key));
    }
    const event = state.event;
    if (!event || String(filter._id) !== String(event._id) || !sameDate(filter.startDate, event.startDate) || !sameDate(filter.endDate, event.endDate)) return null;
    Object.assign(event, update.$set);
    state.writes++;
    return event;
  });
  // Wrap the real model/query methods: rejected requests must not even enter
  // Event lookup/update construction or casting, regardless of library patches.
  state.readQuery = t.mock.method(Event, "findById");
  state.updateQuery = t.mock.method(Event, "findOneAndUpdate");
  state.casting = t.mock.method(mongoose.Query.prototype, "_castUpdate");
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/events", eventRouter);
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"] }, secret, { expiresIn: "1h" });
  state.request = (body, id = eventId, requestToken = token) => new Promise((resolve, reject) => {
    const raw = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const req = Readable.from(raw === undefined ? [] : [Buffer.from(raw)]);
    req.method = "PUT";
    req.url = `/api/events/${id}`;
    req.headers = {
      ...(raw === undefined ? {} : { "content-type": "application/json", "content-length": Buffer.byteLength(raw) }),
      ...(requestToken ? { cookie: `token=${requestToken}` } : {}),
    };
    req.socket = { remoteAddress: "192.0.2.1" };
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (result) => resolve({ status: res.statusCode, body: clone(result) });
    app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
  });
  return state;
}

test("protected metadata and unknown fields reject the entire staff request before Event lookup or casting", async (t) => {
  const state = setup(t);
  const before = clone(state.event);
  for (const [key, value] of Object.entries({
    createdBy: userId, source: "manual", calendarKey: "forged", generatedYear: 9999,
    _id: missingId, createdAt: "2000-01-01", updatedAt: "2000-01-01", __v: 100,
    unknownField: "unexpected", role: ["admin"], overwrite: true,
  })) {
    const result = await state.request({ title: "Must not partially apply", [key]: value });
    assert.equal(result.status, 400, key);
    assert.equal(result.body.success, false);
    assert.deepEqual(clone(state.event), before);
  }
  assert.equal(state.readQuery.mock.callCount(), 0);
  assert.equal(state.updateQuery.mock.callCount(), 0);
  assert.equal(state.casting.mock.callCount(), 0);
});

test("MongoDB operators, pipelines, dotted paths, and prototype payloads never reach update casting", async (t) => {
  const state = setup(t);
  const before = Object.getOwnPropertyDescriptors(Object.prototype);
  for (const body of [
    { $set: { createdBy: userId } }, { $unset: { source: 1 } }, { $rename: { title: "calendarKey" } },
    { $inc: { generatedYear: 1 } }, { $push: { years: 1 } }, { $setOnInsert: { createdBy: userId } },
    [{ $set: { createdBy: userId } }], { "createdBy._id": userId }, { "years.0": 1 },
    '{"__proto__.auditMarker":"synthetic"}', '{"__proto__":{"polluted":true}}',
    '{"constructor":{"prototype":{"polluted":true}}}', '{"prototype":{"polluted":true}}',
    '{"title":"Safe looking","$set":{"__proto__.auditMarker":"synthetic"}}',
    '{"description":{"__proto__.auditMarker":"synthetic"}}',
    '{"years":[{"constructor":{"prototype":{"polluted":true}}}]}',
  ]) {
    assert.equal((await state.request(body)).status, 400);
    assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype), before);
  }
  assert.equal(state.readQuery.mock.callCount(), 0);
  assert.equal(state.updateQuery.mock.callCount(), 0);
  assert.equal(state.casting.mock.callCount(), 0);
});

test("invalid field types and bounds are rejected before Mongoose can coerce them", async (t) => {
  const state = setup(t);
  for (const body of [
    undefined, {}, [], { title: " " }, { title: 1 }, { title: ["Title"] }, { title: { $ne: null } },
    { title: "x".repeat(201) }, { description: {} }, { description: null }, { description: "x".repeat(10_001) },
    { location: [] }, { location: "x".repeat(501) }, { eventType: "Invalid" }, { eventType: {} },
    { allDay: "false" }, { allDay: 1 }, { allDay: null },
    { years: "1" }, { years: null }, { years: ["1"] }, { years: [1, 1] }, { years: [0] },
    { years: [13] }, { years: [1.5] }, { years: Array(13).fill(1) }, { years: [[1]] },
    { startDate: null }, { startDate: 0 }, { startDate: {} }, { endDate: [] },
  ]) {
    assert.equal((await state.request(body)).status, 400);
  }
  assert.equal(state.readQuery.mock.callCount(), 0);
  assert.equal(state.casting.mock.callCount(), 0);
});

test("all editable fields update while authorship and generated-calendar metadata remain intact", async (t) => {
  const state = setup(t);
  const before = metadata(state.event);
  const body = {
    title: " Updated title ", description: "Literal text: $set __proto__.example", eventType: "Feast", location: "New location",
    startDate: "2026-10-16T10:00:00+02:00", endDate: "2026-10-16T12:00:00+02:00", allDay: true, years: [1, 3, 12],
  };
  const result = await state.request(body);
  assert.equal(result.status, 200);
  assert.equal(result.body.event.title, "Updated title");
  assert.equal(result.body.event.description, body.description);
  assert.equal(result.body.event.startDate, "2026-10-16T08:00:00.000Z");
  assert.equal(result.body.event.allDay, true);
  assert.deepEqual(result.body.event.years, body.years);
  assert.deepEqual(metadata(state.event), before);
  const [, update, options] = state.updateQuery.mock.calls[0].arguments;
  assert.deepEqual(Object.keys(update), ["$set"]);
  assert.equal(options.strict, "throw");
  assert.equal(options.runValidators, true);
  assert.equal(state.writes, 1);
});

test("all four staff roles retain partial edits for manual and generated events", async (t) => {
  const state = setup(t);
  for (const source of ["manual", "coptic-calendar"]) {
    state.event.source = source;
    const before = metadata(state.event);
    for (const role of ["admin", "leader", "pascal", "pamela"]) {
      state.user.role = [role];
      const result = await state.request({ title: `Title ${role}` });
      assert.equal(result.status, 200);
      assert.deepEqual(metadata(state.event), before);
      assert.equal(state.event.description, "Original description");
      assert.deepEqual(state.event.years, [1, 2]);
    }
  }
});

test("clearing optional fields and using false or an empty years array remains supported", async (t) => {
  const state = setup(t);
  const result = await state.request({ endDate: null, description: "", location: "", allDay: false, years: [] });
  assert.equal(result.status, 200);
  assert.equal(result.body.event.endDate, null);
  assert.equal(result.body.event.description, "");
  assert.equal(result.body.event.location, "");
  assert.equal(result.body.event.allDay, false);
  assert.deepEqual(result.body.event.years, []);
  assert.equal((await state.request({ endDate: "" })).status, 200);
});

test("dates reject impossible calendar values and validate partial updates against stored dates", async (t) => {
  const state = setup(t);
  for (const value of ["invalid", "2026-02-29", "2026-02-30", "2026-04-31", "2026-00-01", "2026-13-01", "0000-01-01",
    "2026-10-15T24:00", "2026-10-15T10:60", "2026-10-15T10:00:60Z", "2026-10-15T10:00+24:00"]) {
    assert.equal((await state.request({ startDate: value })).status, 400);
  }
  assert.equal(state.reads, 0);
  assert.equal((await state.request({ startDate: "2026-10-16" })).status, 400);
  assert.equal((await state.request({ endDate: "2026-10-14" })).status, 400);
  assert.equal(state.writes, 0);
  assert.equal((await state.request({ startDate: "2028-02-29T09:00", endDate: "2028-02-29T10:00" })).status, 200);
});

test("concurrent date edits and deletion produce a conflict without applying stale changes", async (t) => {
  const state = setup(t);
  state.race = () => { state.event.endDate = new Date("2026-10-15T10:30Z"); };
  const result = await state.request({ startDate: "2026-10-15T11:00Z" });
  assert.equal(result.status, 409);
  assert.equal(state.event.startDate.toISOString(), "2026-10-15T10:00:00.000Z");
  assert.equal(state.writes, 0);
  state.race = () => { state.event = null; };
  assert.equal((await state.request({ title: "Deleted meanwhile" })).status, 409);
});

test("invalid and missing event IDs do not create records or report false success", async (t) => {
  const state = setup(t);
  assert.equal((await state.request({ title: "Safe" }, "invalid")).status, 400);
  assert.equal(state.readQuery.mock.callCount(), 0);
  assert.equal((await state.request({ title: "Safe" }, missingId)).status, 404);
  assert.equal(state.updateQuery.mock.callCount(), 0);
});

test("reader roles and forged token/body roles cannot update events", async (t) => {
  const state = setup(t);
  for (const role of [["parent"], ["unAssigned"], [], ["unknown"]]) {
    state.user.role = role;
    assert.equal((await state.request({ title: "Forbidden", role: ["admin"] })).status, 403);
  }
  assert.equal(state.readQuery.mock.callCount(), 0);
  assert.equal(state.updateQuery.mock.callCount(), 0);
});

test("current permissions, verified status, and session revocation gate updates", async (t) => {
  const state = setup(t);
  assert.equal((await state.request({ title: "Allowed" })).status, 200);
  const reads = state.reads;
  state.user.role = ["parent"];
  assert.equal((await state.request({ title: "Demoted" })).status, 403);
  state.user.role = ["leader"];
  state.user.isAccountVerified = false;
  assert.equal((await state.request({ title: "Unverified" })).status, 403);
  state.user.isAccountVerified = true;
  state.user.tokenVersion = 1;
  assert.equal((await state.request({ title: "Revoked" })).status, 401);
  state.user.tokenVersion = 0;
  assert.equal((await state.request({ title: "Anonymous" }, eventId, null)).status, 401);
  state.missingRoleUser = true;
  assert.equal((await state.request({ title: "Deleted during check" })).status, 401);
  state.missingRoleUser = false;
  state.roleError = true;
  t.mock.method(console, "error", () => {});
  assert.equal((await state.request({ title: "Lookup unavailable" })).status, 500);
  assert.equal(state.reads, reads);
});

test("Mongoose validation and database failures return safe errors without updating protected fields", async (t) => {
  const state = setup(t);
  const before = clone(state.event);
  for (const [name, status] of [["ValidationError", 400], ["CastError", 400], ["StrictModeError", 400], ["Error", 500]]) {
    state.writeError = Object.assign(new Error("Private database diagnostics"), { name });
    const result = await state.request({ title: "Safe" });
    assert.equal(result.status, status);
    assert.equal(JSON.stringify(result.body).includes("Private"), false);
    assert.deepEqual(clone(state.event), before);
  }
});

test("the validator rejects non-JSON object prototypes and shares event types with the model", () => {
  for (const body of [null, "text", 1, new Date(), Object.create({ title: "Inherited" }), { years: Array(1) }]) {
    assert.equal(validateEventUpdate(body).success, false);
  }
  const body = Object.create(null);
  body.title = "Plain data";
  assert.equal(validateEventUpdate(body).success, true);
  assert.deepEqual(Event.schema.path("eventType").enumValues, EVENT_TYPES);
  for (const eventType of EVENT_TYPES) assert.equal(validateEventUpdate({ eventType }).success, true);
});
