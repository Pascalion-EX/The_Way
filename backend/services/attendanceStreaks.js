import mongoose from "mongoose";
import Attendance from "../models/attendanceModel.js";

export const getConsecutiveAbsences = async (filter, throughDate) => {
  const history = await Attendance.find({
    ...filter,
    serviceDate: mongoose.trusted({ $lte: throughDate }),
  })
    .select("child status serviceDate")
    .sort({ child: 1, serviceDate: -1 })
    .lean();

  const counts = Object.create(null);
  const finished = new Set();
  for (const record of history) {
    const childId = String(record.child);
    if (finished.has(childId)) continue;
    counts[childId] ??= 0;
    if (record.status === "absent") counts[childId] += 1;
    else finished.add(childId);
  }
  return counts;
};
