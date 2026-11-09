import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { test } from "node:test";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import Camp from "../models/campsModel.js";
import { migrateServantRole, ServantRoleMigrationError } from "../services/servantRoleMigration.js";

// A small collection boundary for testing dry runs, interrupted migrations,
// field preservation, and conflict handling without a production database.
function valuesAt(value, path) {
  if (Array.isArray(value)) return value.flatMap((item) => valuesAt(item, path));
  if (path.length === 0) return [value];
  return valuesAt(value?.[path[0]], path.slice(1));
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some((part) => matches(document, part));
    if (expected instanceof RegExp) return valuesAt(document, key.split(".")).some((value) => expected.test(value));
    if (expected?.$exists !== undefined) return valuesAt(document, key.split(".")).some((value) => value !== undefined) === expected.$exists;
    return isDeepStrictEqual(document[key], expected);
  });
}

function collection(records) {
  return {
    records,
    writes: 0,
    failUpdate: false,
    find(filter) {
      const found = records.filter((record) => matches(record, filter)).map((record) => structuredClone(record));
      return { async *[Symbol.asyncIterator]() { yield* found; } };
    },
    async updateOne(filter, update) {
      const record = this.failUpdate ? null : records.find((value) => matches(value, filter));
      if (!record) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(record, update.$set);
      this.writes++;
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async countDocuments(filter) { return records.filter((record) => matches(record, filter)).length; },
  };
}

function fixture() {
  return {
    users: collection([
      { _id: "mixed", role: ["parent", "leader", "admin", "servant"], class: 3, isAccountVerified: true, tokenVersion: 7, password: "untouched" },
      { _id: "scalar", role: "Leader", class: 12 },
      { _id: "upper", role: ["LEADER", "pamela"] },
      { _id: "other", role: ["parent"], class: 4 },
    ]),
    notifications: collection([
      { _id: "notice", targetRoles: ["parent", "leader", "servant"], seenBy: ["mixed"], message: "Leader mentioned in free text" },
      { _id: "other", targetRoles: ["parent"] },
    ]),
    camps: collection([
      { _id: "camp", title: "Trip", updatedAt: new Date("2026-11-01T00:00:00Z"), applicants: [
        { _id: "applicant", user: "mixed", applicationType: "leader", leaderName: "Existing name", leaderRole: "Service", parentPhone: "123", notes: "Preserve", paymentScreenshot: "receipt", appliedAt: new Date("2026-10-31T00:00:00Z") },
        { _id: "parent", user: "other", applicationType: "parent_for_child", childName: "Child", leaderName: "", leaderRole: "" },
        { _id: "legacy", user: "old-user", appliedAt: new Date("2026-10-20T00:00:00Z") },
      ] },
      { _id: "unrelated", applicants: [] },
    ]),
  };
}

const records = (collections) => Object.fromEntries(Object.entries(collections).map(([key, value]) => [key, value.records]));

test("the migration previews affected records without changing data", async () => {
  const collections = fixture();
  const before = structuredClone(records(collections));
  assert.deepEqual(await migrateServantRole(collections), {
    mode: "dry-run", planned: { users: 3, notifications: 1, camps: 1 }, modified: { users: 0, notifications: 0, camps: 0 },
  });
  assert.deepEqual(records(collections), before);
  assert.ok(Object.values(collections).every((value) => value.writes === 0));
});

test("apply preserves other roles, account state, notifications, and complete trip applications and is idempotent", async () => {
  const collections = fixture();
  const before = structuredClone(records(collections));
  const result = await migrateServantRole(collections, { apply: true });
  assert.deepEqual(result.modified, { users: 3, notifications: 1, camps: 1 });
  assert.deepEqual(result.remaining, { users: 0, notifications: 0, camps: 0 });
  assert.deepEqual(collections.users.records, before.users.map((user) => ({ ...user, role: {
    mixed: ["parent", "servant", "admin"], scalar: ["servant"], upper: ["servant", "pamela"], other: ["parent"],
  }[user._id] })));
  assert.deepEqual(collections.notifications.records, before.notifications.map((notice) => notice._id === "notice"
    ? { ...notice, targetRoles: ["parent", "servant"] } : notice));
  const expectedCamps = before.camps;
  for (const applicant of expectedCamps[0].applicants) {
    if (applicant._id === "legacy") continue;
    applicant.servantName = applicant.leaderName;
    applicant.servantRole = applicant.leaderRole;
    delete applicant.leaderName;
    delete applicant.leaderRole;
    if (applicant.applicationType === "leader") applicant.applicationType = "servant";
  }
  assert.deepEqual(collections.camps.records, expectedCamps);
  const after = structuredClone(records(collections));
  const repeated = await migrateServantRole(collections, { apply: true });
  assert.deepEqual(repeated.modified, { users: 0, notifications: 0, camps: 0 });
  assert.deepEqual(records(collections), after);
});

test("conflicting applicant details abort preflight before any collection is written", async () => {
  for (const [oldField, newField] of [["leaderName", "servantName"], ["leaderRole", "servantRole"]]) {
    const collections = fixture();
    collections.camps.records[0].applicants[0][newField] = `Different ${oldField}`;
    const before = structuredClone(records(collections));
    await assert.rejects(migrateServantRole(collections, { apply: true }), ServantRoleMigrationError);
    assert.deepEqual(records(collections), before);
    assert.ok(Object.values(collections).every((value) => value.writes === 0));
  }
});

test("partially renamed applicants preserve current details and remove redundant legacy fields", async () => {
  const collections = fixture();
  const applicant = collections.camps.records[0].applicants[0];
  applicant.servantName = applicant.leaderName;
  applicant.servantRole = "Current service";
  applicant.leaderRole = "";
  await migrateServantRole(collections, { apply: true });
  const updated = collections.camps.records[0].applicants[0];
  assert.equal(updated.servantName, "Existing name");
  assert.equal(updated.servantRole, "Current service");
  assert.equal(Object.hasOwn(updated, "leaderName"), false);
  assert.equal(Object.hasOwn(updated, "leaderRole"), false);
});

test("a failed conditional update stops safely and a subsequent run finishes the migration", async () => {
  const collections = fixture();
  collections.notifications.failUpdate = true;
  await assert.rejects(migrateServantRole(collections, { apply: true }), /record changed during migration/);
  assert.equal(collections.users.writes, 3);
  assert.equal(collections.notifications.writes, 0);
  assert.equal(collections.camps.writes, 0);
  collections.notifications.failUpdate = false;
  const result = await migrateServantRole(collections, { apply: true });
  assert.deepEqual(result.modified, { users: 0, notifications: 1, camps: 1 });
  assert.deepEqual(result.remaining, { users: 0, notifications: 0, camps: 0 });
});

test("the current schemas accept servant roles and application details and reject the retired role", async () => {
  const user = new User({ name: "Servant", email: "servant@example.com", password: "stored-hash", role: ["servant"] });
  const notice = new Notification({ targetRoles: ["servant"], url: "/" });
  const camp = new Camp({ title: "Trip", name: "Trip", body: "Details", TripType: "Trip", years: [3], createdBy: user._id,
    applicants: [{ user: user._id, applicationType: "servant", servantName: "Name", servantRole: "Service" }] });
  for (const model of [user, notice, camp]) await model.validate();
  assert.equal(camp.applicants[0].servantName, "Name");
  assert.equal(camp.applicants[0].servantRole, "Service");
  user.role = ["leader"];
  notice.targetRoles = ["leader"];
  camp.applicants[0].applicationType = "leader";
  for (const model of [user, notice, camp]) await assert.rejects(model.validate(), /not a valid enum value/);
});
