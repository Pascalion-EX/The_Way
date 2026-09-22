import express from "express";

import {
  takeAttendance,
  takeWeeklyAttendance,
  getAttendanceByDate,
  getChildAttendance,
  getAttendanceByYear,
  updateAttendance,
  deleteAttendance,
} from "../controllers/attendanceController.js";

import userAuth from "../middleware/userAuth.js";

const attendanceRouter = express.Router();

attendanceRouter.post("/", userAuth, takeAttendance);

attendanceRouter.post(
  "/weekly",
  userAuth,
  takeWeeklyAttendance
);

attendanceRouter.get(
  "/date/:date",
  userAuth,
  getAttendanceByDate
);

attendanceRouter.get(
  "/child/:childId",
  userAuth,
  getChildAttendance
);

attendanceRouter.get(
  "/year/:year",
  userAuth,
  getAttendanceByYear
);

attendanceRouter.put(
  "/:id",
  userAuth,
  updateAttendance
);

attendanceRouter.delete(
  "/:id",
  userAuth,
  deleteAttendance
);

export default attendanceRouter;