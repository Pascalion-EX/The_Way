import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import Attendance from "../models/attendanceModel.js";
import { getConsecutiveAbsences } from "../services/attendanceStreaks.js";

const childIds = ["6ac82222376fb9c75f5b3961", "6ab26af3171afea3091f04af"];
const date = (value) => new Date(`${value}T00:00:00Z`);
const row = (serviceDate, status, child = childIds[0]) => ({
  child: new mongoose.Types.ObjectId(child), serviceDate: date(serviceDate), status,
});

const setup = (t, rows) => {
  const previous = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previous));
  // Preserve Mongoose's real filter sanitization, ObjectId/date casting and query options.
  t.mock.method(Attendance.collection, "find", (filter, options) => {
    assert.ok(filter.serviceDate.$lte instanceof Date);
    assert.deepEqual(options.sort, { child: 1, serviceDate: -1 });
    assert.equal(options.projection.child, 1);
    assert.equal(options.projection.status, 1);
    assert.equal(options.projection.serviceDate, 1);
    return {
      toArray: async () => rows.filter((record) =>
        record.serviceDate <= filter.serviceDate.$lte &&
        (!filter.child || filter.child.$in.some((id) => String(id) === String(record.child)))
      ).sort((a, b) => String(a.child).localeCompare(String(b.child)) || b.serviceDate - a.serviceDate),
    };
  });
};

test("consecutive absence counts stop at the latest non-absence and exclude future records", async (t) => {
  setup(t, [
    row("2026-10-07", "absent"), row("2026-10-21", "present"),
    row("2026-09-23", "absent"), row("2026-10-14", "absent"),
    row("2026-09-30", "present"), row("2026-10-14", "present", childIds[1]),
    row("2026-10-07", "absent", childIds[1]),
  ]);
  const counts = await getConsecutiveAbsences({}, date("2026-10-14"));
  assert.equal(counts[childIds[0]], 2);
  assert.equal(counts[childIds[1]], 0);
  assert.equal((await getConsecutiveAbsences({}, date("2026-10-21")))[childIds[0]], 0);
  assert.equal((await getConsecutiveAbsences({}, date("2026-10-07")))[childIds[0]], 1);
});

for (const status of ["present", "late", "excused"]) {
  test(`${status} resets an absence streak`, async (t) => {
    setup(t, [row("2026-09-30", "absent"), row("2026-10-07", status), row("2026-10-14", "absent")]);
    assert.equal((await getConsecutiveAbsences({}, date("2026-10-07")))[childIds[0]], 0);
    assert.equal((await getConsecutiveAbsences({}, date("2026-10-14")))[childIds[0]], 1);
  });
}

test("counts cross year boundaries and skip unrecorded weeks without inventing absences", async (t) => {
  setup(t, [row("2025-12-24", "absent"), row("2025-12-31", "absent"), row("2026-01-14", "absent")]);
  assert.equal((await getConsecutiveAbsences({}, date("2026-01-14")))[childIds[0]], 3);
});

test("class filters exclude other children and no history produces empty counts", async (t) => {
  setup(t, [row("2026-10-14", "absent"), row("2026-10-14", "absent", childIds[1])]);
  const counts = await getConsecutiveAbsences({ child: mongoose.trusted({ $in: [childIds[0]] }) }, date("2026-10-14"));
  assert.deepEqual(Object.keys(counts), [childIds[0]]);
  assert.equal(counts[childIds[0]], 1);
  assert.deepEqual(Object.keys(await getConsecutiveAbsences({}, date("2026-10-07"))), []);
  assert.deepEqual(Object.keys(await getConsecutiveAbsences({ child: mongoose.trusted({ $in: [] }) }, date("2026-10-14"))), []);
});

test("historical corrections and deletions recalculate counts without a stored counter", async (t) => {
  const rows = [row("2026-09-30", "absent"), row("2026-10-07", "absent"), row("2026-10-14", "absent")];
  setup(t, rows);
  const count = async () => (await getConsecutiveAbsences({}, date("2026-10-14")))[childIds[0]];
  assert.equal(await count(), 3);
  rows[1].status = "present";
  assert.equal(await count(), 1);
  rows.pop();
  assert.equal(await count(), 0);
});
