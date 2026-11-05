import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Camp from "../models/campsModel.js";
import CampPaymentScreenshot from "../models/campPaymentScreenshotModel.js";
import sharp from "sharp";
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
const summaryKeys = ["_id", "title", "name", "body", "TripType", "image", "price", "paymentQrImage", "years", "createdAt", "updatedAt", "applicantCount", "hasApplied"].sort();
const cardKeys = ["_id", "title", "name", "image", "price", "hasApplied"].sort();
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
      _id: objectId(campId), title: "Trip", name: "Trip team", body: "Public description", TripType: "Trip", image: "", price: 0, paymentQrImage: "", years: [1, 2],
      createdBy: objectId(otherId), createdAt: new Date("2026-10-15T00:00:00Z"), updatedAt: new Date("2026-10-15T00:00:00Z"),
      applicants: [{ _id: objectId(missingId), user: objectId(otherId), appliedAt: new Date("2026-10-14T00:00:00Z"), notes: "private-note", parentPhone: "private-phone" }],
      internalEmail: "private@example.com", futurePrivateField: "private-extra", __v: 0,
    },
    pipelines: [], campReads: [], populations: 0, writes: 0,
    roleLookupError: false, missingRoleUser: false,
    screenshots: new Map(), screenshotReads: 0, failCampSave: false,
  };
  t.mock.method(User.collection, "findOne", async (filter, options) => {
    assert.equal(String(filter._id), userId);
    if (options?.projection?.role) {
      if (state.roleLookupError) throw new Error("Private role lookup details");
      if (state.missingRoleUser) return null;
    }
    return state.user ? projection(state.user, options?.projection) : null;
  });
  // Treat permission-matrix cases as independent first denials.
  t.mock.method(User, "findOneAndUpdate", async () => ({ accessDeniedCount: 1 }));
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
    assert.deepEqual(Object.keys(fields).sort(), pipeline[0].$match._id ? summaryKeys : cardKeys, "Lists contain cards; details include public content");
    if (fields.applicantCount) assert.deepEqual(fields.applicantCount, { $size: { $ifNull: ["$applicants", []] } });
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
      ...(fields.applicantCount ? { applicantCount: camp.applicants?.length || 0 } : {}),
      hasApplied: camp.applicants?.some((applicant) => String(applicant.user) === userId) || false,
    }] : [];
    return { toArray: async () => records };
  });
  t.mock.method(Camp.collection, "findOne", async (filter, options) => {
    state.campReads.push({ filter, options });
    return state.camp && String(filter._id) === String(state.camp._id) ? projection(state.camp, options?.projection) : null;
  });
  t.mock.method(Camp.collection, "updateOne", async (filter, update) => {
    if (state.failCampSave) throw new Error("Private database details");
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
  t.mock.method(Camp.collection, "findOneAndDelete", async () => {
    const camp = state.camp;
    state.camp = null;
    return camp;
  });
  t.mock.method(CampPaymentScreenshot.collection, "insertOne", async (record) => {
    state.screenshots.set(String(record._id), record);
    return { acknowledged: true, insertedId: record._id };
  });
  t.mock.method(CampPaymentScreenshot.collection, "findOne", async (filter) => {
    state.screenshotReads++;
    const record = state.screenshots.get(String(filter._id));
    return record && String(record.camp) === String(filter.camp) && String(record.user) === String(filter.user) ? record : null;
  });
  t.mock.method(CampPaymentScreenshot.collection, "deleteMany", async (filter) => {
    for (const [id, record] of state.screenshots) {
      if (Object.entries(filter).every(([key, value]) => String(record[key]) === String(value))) state.screenshots.delete(id);
    }
    return { acknowledged: true };
  });
  const app = express();
  app.use(cookieParser());
  app.use("/api/camps", campRouter);
  // Forged claims and request fields must never grant roster access or select
  // whose registration status is returned.
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"] }, secret, { expiresIn: "1h" });
  state.request = (method = "GET", path = "", body = {}, requestToken = token, upload) => new Promise((resolve, reject) => {
    const boundary = "camp-payment-test-boundary";
    const multipart = upload && Buffer.concat([
      ...Object.entries(body).map(([key, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="paymentScreenshot"; filename="receipt.png"\r\nContent-Type: ${upload.type}\r\n\r\n`),
      upload.buffer, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const req = Readable.from(multipart ? [multipart] : []);
    req.method = method;
    req.url = `/api/camps${path}`;
    req.headers = requestToken ? { cookie: `token=${requestToken}` } : {};
    if (upload) Object.assign(req.headers, { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": multipart.length });
    req.body = { ...body, userId: otherId, role: ["admin"], user: { role: ["admin"] } };
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (result) => resolve({ status: res.statusCode, body: clone(result), headers });
    res.send = (result) => resolve({ status: res.statusCode, body: result, headers });
    app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
  });
  state.upload = (body, buffer, type = "image/png") => state.request("POST", `/${campId}/apply`, body, token, { buffer, type });
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

const assertCard = (camp, applied = false) => {
  assert.deepEqual(Object.keys(camp).sort(), cardKeys);
  assert.equal(camp.title, "Trip");
  assert.equal(camp.hasApplied, applied);
  assert.equal(JSON.stringify(camp).includes("Public description"), false);
};

test("unrelated members receive only counts and their own status from camp lists and details", async (t) => {
  const state = setup(t);
  for (const role of ["parent", "unAssigned", "admin", "leader", "pascal", "pamela"]) {
    state.user.role = [role];
    const list = await state.request("GET", `?userId=${otherId}&role=admin&populate=applicants.user`);
    const detail = await state.request("GET", `/${campId}?userId=${otherId}&populate=createdBy`);
    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assertCard(list.body.camps[0]);
    assert.equal(detail.body.camp.body, "Public description");
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
  assertCard((await state.request()).body.camps[0]);
  delete state.camp.applicants;
  assertCard((await state.request()).body.camps[0]);
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
    assert.deepEqual(Object.keys(result.body.applicants[0]).sort(), ["_id", "appliedAt", "childName", "leaderName", "leaderRole", "notes", "parentPhone", "user"]);
    assert.deepEqual(state.campReads.at(-1).options.projection, { applicants: 1 });
    assert.equal(JSON.stringify(result.body).includes("private-hash"), false);
    assert.equal(result.body.applicants[0].parentPhone, "private-phone");
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
  assert.equal((await state.request("GET", "?year=12")).body.camps.length, 0);
  assert.equal((await state.request("GET", "?year=0")).body.camps.length, 1);
  assert.equal(Object.hasOwn(state.pipelines.at(-1)[0].$match, "years"), false);
  assert.equal((await state.request("GET", "?search=.*")).body.camps.length, 0, "Search metacharacters are literal");
  for (const query of ["?year=13", "?year=-1", "?year=1.5", "?year=invalid", "?year=1&year=2", "?tripType=invalid", `?search=${"x".repeat(201)}`]) {
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

const parentApplication = {
  applicationType: "parent_for_child", childName: "Child name", childYear: 2, parentPhone: "01012345678", notes: "Meal request",
};
const paymentQrImage = `/uploads/${"a".repeat(64)}.webp`;
const receiptImage = () => sharp({ create: { width: 24, height: 32, channels: 3, background: "white" } }).png().toBuffer();

test("camp creation validates EGP prices and requires an uploaded QR image for paid camps", async (t) => {
  const state = setup(t);
  state.user.role = ["admin"];
  const camp = { title: "Paid camp", name: "Team", body: "Description", years: [1, 2], TripType: "Camp" };
  for (const fields of [{ price: -1 }, { price: "100" }, { price: null }, { price: 1.001 }, { price: 100 },
    { price: 100, paymentQrImage: "https://example.invalid/qr.png" }, { price: 100, paymentQrImage: {} }]) {
    const response = await state.request("POST", "", { ...camp, ...fields });
    assert.equal(response.status, 400, JSON.stringify(fields));
    assert.equal(state.writes, 0);
  }
  const response = await state.request("POST", "", { ...camp, price: 1250.50, paymentQrImage });
  assert.equal(response.status, 201);
  assert.equal(response.body.camp.price, 1250.50);
  assert.equal(response.body.camp.paymentQrImage, paymentQrImage);
  assert.equal(state.camp.price, 1250.50);
});

test("payment settings updates validate the resulting price and QR together", async (t) => {
  const state = setup(t);
  state.user.role = ["leader"];
  assert.equal((await state.request("PUT", `/${campId}`, { price: 500 })).status, 400);
  assert.equal((await state.request("PUT", `/${campId}`, { price: 500, paymentQrImage })).status, 200);
  const updated = await state.request("PUT", `/${campId}`, { price: 600.25 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.camp.price, 600.25);
  assert.equal(updated.body.camp.paymentQrImage, paymentQrImage);
  assert.equal((await state.request("PUT", `/${campId}`, { paymentQrImage: "" })).status, 400);
  assert.equal((await state.request("PUT", `/${campId}`, { price: 0, paymentQrImage: "" })).status, 200);
});

test("parents cannot submit paid applications without proof or bypass it using a different application type", async (t) => {
  const state = setup(t);
  state.camp.price = 100;
  state.camp.paymentQrImage = paymentQrImage;
  const missing = await state.request("POST", `/${campId}/apply`, parentApplication);
  assert.equal(missing.status, 400);
  assert.match(missing.body.message, /payment screenshot is required/);
  for (const applicationType of ["leader", "child_self", "unknown"]) {
    const response = await state.request("POST", `/${campId}/apply`, { ...parentApplication, applicationType });
    assert.ok([400, 403].includes(response.status));
  }
  assert.equal(state.writes, 0);
  assert.equal(state.screenshots.size, 0);
});

test("multipart application stores a normalized private receipt and all application details", async (t) => {
  const state = setup(t);
  state.camp.price = 500;
  const result = await state.upload(parentApplication, await receiptImage());
  assert.equal(result.status, 200);
  assertSummary(result.body.camp, 2, true);
  assert.doesNotMatch(JSON.stringify(result.body), /paymentScreenshot|Child name|Meal request|01012345678/);
  const applicant = state.camp.applicants.at(-1);
  assert.equal(applicant.childName, parentApplication.childName);
  assert.equal(applicant.childYear, 2);
  assert.equal(applicant.parentPhone, parentApplication.parentPhone);
  assert.equal(applicant.notes, parentApplication.notes);
  assert.equal(applicant.applicationType, "parent_for_child");
  assert.equal(state.screenshots.size, 1);
  const path = `/${campId}/applicants/${applicant._id}/payment`;
  assert.equal((await state.request("GET", path)).status, 403);
  assert.equal(state.screenshotReads, 0);
  state.user.role = ["leader"];
  const roster = await state.request("GET", `/${campId}/applicants`);
  assert.equal(roster.body.applicants.at(-1).paymentScreenshotUrl, `/api/camps${path}`);
  assert.equal(roster.body.applicants.at(-1).childName, parentApplication.childName);
  assert.doesNotMatch(JSON.stringify(roster.body), /"image"|"data"/);
  const screenshot = await state.request("GET", path);
  assert.equal(screenshot.status, 200);
  assert.equal(screenshot.headers.get("content-type"), "image/webp");
  assert.equal(screenshot.headers.get("cache-control"), "private, no-store");
  assert.equal(screenshot.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await sharp(screenshot.body).metadata()).format, "webp");
  assert.equal((await state.upload(parentApplication, await receiptImage())).status, 400);
  assert.equal(state.screenshots.size, 1);
  // A receipt from another camp or user cannot be read through this applicant.
  const stored = [...state.screenshots.values()][0];
  stored.camp = objectId(missingId);
  assert.equal((await state.request("GET", path)).status, 404);
  stored.camp = objectId(campId);
  stored.user = objectId(otherId);
  assert.equal((await state.request("GET", path)).status, 404);
  assert.equal((await state.request("GET", `/${campId}/applicants/invalid/payment`)).status, 400);
  assert.equal((await state.request("GET", `/${campId}/applicants/${missingId}/payment`)).status, 404);
});

test("payment uploads reject unsupported, corrupt and oversized images without saving an application", async (t) => {
  const state = setup(t);
  state.camp.price = 500;
  assert.equal((await state.upload(parentApplication, Buffer.from("<svg/>"), "image/svg+xml")).status, 415);
  assert.equal((await state.upload(parentApplication, Buffer.from("not a PNG"))).status, 400);
  assert.equal((await state.upload(parentApplication, Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  assert.equal(state.writes, 0);
  assert.equal(state.screenshots.size, 0);
});

test("failed applications, withdrawals and camp deletion remove their private receipts", async (t) => {
  const state = setup(t);
  state.camp.price = 500;
  state.failCampSave = true;
  const failure = await state.upload(parentApplication, await receiptImage());
  assert.equal(failure.status, 500);
  assert.doesNotMatch(JSON.stringify(failure.body), /Private database details/);
  assert.equal(state.screenshots.size, 0);
  state.failCampSave = false;
  assert.equal((await state.upload(parentApplication, await receiptImage())).status, 200);
  assert.equal(state.screenshots.size, 1);
  assert.equal((await state.request("DELETE", `/${campId}/apply`)).status, 200);
  assert.equal(state.screenshots.size, 0);
  assert.equal((await state.upload(parentApplication, await receiptImage())).status, 200);
  state.user.role = ["admin"];
  assert.equal((await state.request("DELETE", `/${campId}`)).status, 200);
  assert.equal(state.screenshots.size, 0);
});

test("legacy applications stay valid and leaders can register for paid camps without a parent receipt", async (t) => {
  const state = setup(t);
  state.camp.price = 100;
  state.user.role = ["leader"];
  const result = await state.request("POST", `/${campId}/apply`, {
    applicationType: "leader", leaderName: "Leader", leaderRole: "Service", parentPhone: "123",
  });
  assert.equal(result.status, 200);
  assert.equal(state.camp.applicants.length, 2);
  assert.equal(state.camp.applicants.at(-1).leaderName, "Leader");
  assert.equal(state.screenshots.size, 0);
});
