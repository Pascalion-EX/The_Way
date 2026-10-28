import mongoose from "mongoose";
import YearOneToThreeActivity from "../models/yearOneToThreeActivityModel.js";
import { canAccessYearOneToThreeActivities } from "../../shared/pageAccess.mjs";
import {
  currentScheduleMonth,
  isScheduleMonth,
  isScheduleWednesday,
  wednesdaysForMonth,
  scheduleMonthDetails,
  scheduleDateLabel,
} from "../utils/activitySchedule.js";

export async function getYearOneToThreeSchedule(req, res) {
  const currentMonth = currentScheduleMonth();
  const month = req.query.month === undefined ? currentMonth : req.query.month;
  if (!isScheduleMonth(month)) {
    return res.status(400).json({ success: false, message: "Choose a valid month" });
  }
  try {
    const dates = wednesdaysForMonth(month);
    const saved = await YearOneToThreeActivity.find({ date: mongoose.trusted({ $in: dates }) })
      .select("date activity updatedAt -_id").lean();
    const byDate = new Map(saved.map((entry) => [entry.date, entry]));
    const identity = req.staffUser;
    return res.json({
      success: true,
      ...scheduleMonthDetails(month),
      currentMonth,
      canEdit: canAccessYearOneToThreeActivities(identity?.role, identity?.class),
      entries: dates.map((date) => ({
        date,
        dateLabel: scheduleDateLabel(date),
        activity: byDate.get(date)?.activity || "",
        updatedAt: byDate.get(date)?.updatedAt || null,
      })),
    });
  } catch {
    return res.status(500).json({ success: false, message: "Unable to load the activity schedule" });
  }
}

export async function saveYearOneToThreeActivity(req, res) {
  const { date } = req.params;
  const activity = req.body?.activity;
  if (!isScheduleWednesday(date)) {
    return res.status(400).json({ success: false, message: "Choose a valid Wednesday" });
  }
  if (typeof activity !== "string" || activity.length > 2000) {
    return res.status(400).json({ success: false, message: "Activity must be text of at most 2,000 characters" });
  }
  try {
    const entry = await YearOneToThreeActivity.findOneAndUpdate(
      { date },
      { $set: { activity: activity.trim(), updatedBy: req.userId } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).select("date activity updatedAt -_id").lean();
    return res.json({ success: true, message: "Activity saved", entry });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message: error.code === 11000 ? "This date was just updated. Please try saving again." : "Unable to save the activity",
    });
  }
}
