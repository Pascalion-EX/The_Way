import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { takeWeeklyAttendance } from "../controllers/attendanceControllers.js";
import Attendance from "../models/attendanceModel.js";
import Child from "../models/childProfileModel.js";
import User from "../models/userModel.js";

const childIds = [
  "6ac82222376fb9c75f5b3961",
  "6ab26af3171afea3091f04af",
  "6ab26b08171afea3091f04b2",
];
const userId = "6ab26b08171afea3091f04b3";

test("weekly attendance saves and populates with sanitizeFilter enabled", async (t) => {
  const previous = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previous));

  const children = childIds.map((id) => ({
    _id: new mongoose.Types.ObjectId(id),
    name: `Child ${id}`,
    grade: 1,
  }));
  // Keep real Mongoose sanitization, casting, and population; stub only DB I/O.
  t.mock.method(Child.collection, "find", (filter) => {
    assert.deepEqual(filter._id.$in.map(String), childIds);
    return { toArray: async () => children };
  });
  const write = t.mock.method(Attendance, "bulkWrite", async () => ({}));
  t.mock.method(Attendance.collection, "find", () => ({
    toArray: async () => children.map((child) => ({
      _id: new mongoose.Types.ObjectId(),
      child: child._id,
      recordedBy: new mongoose.Types.ObjectId(userId),
      serviceDate: new Date("2026-10-14T00:00:00Z"),
      serviceYear: 2026,
      status: "present",
    })),
  }));
  t.mock.method(User.collection, "find", () => ({
    toArray: async () => [{ _id: new mongoose.Types.ObjectId(userId), name: "Recorder" }],
  }));

  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await takeWeeklyAttendance({
    userId,
    body: {
      serviceDate: "2026-10-14",
      attendance: childIds.map((child) => ({ child, status: "present" })),
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 3);
  assert.equal(write.mock.callCount(), 1);
  assert.deepEqual(write.mock.calls[0].arguments[0].map((op) => op.updateOne.filter.child), childIds);
  for (const record of res.body.attendance) {
    assert.ok(record.child.name.startsWith("Child "));
    assert.equal(record.recordedBy.name, "Recorder");
  }
});

test("weekly attendance rejects missing children before writing", async (t) => {
  const previous = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previous));
  t.mock.method(Child.collection, "find", () => ({ toArray: async () => [] }));
  const write = t.mock.method(Attendance, "bulkWrite", async () => ({}));
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await takeWeeklyAttendance({
    userId,
    body: {
      serviceDate: "2026-10-14",
      attendance: childIds.map((child) => ({ child })),
    },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "One or more child profiles were not found");
  assert.equal(write.mock.callCount(), 0);
});
