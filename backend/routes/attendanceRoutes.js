import express from "express";

import {
  getAttendanceChildren,
  takeAttendance,
  takeWeeklyAttendance,
  getAttendanceByDate,
  getChildAttendance,
  getAttendanceByYear,
  updateAttendance,
  deleteAttendance,
} from "../controllers/attendanceControllers.js";

import userAuth from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";
import { requireAttendanceAccess } from "../middleware/attendanceAuth.js";

const attendanceRouter = express.Router();

attendanceRouter.use(userAuth, requireStaff, requireAttendanceAccess);

attendanceRouter.get("/children", getAttendanceChildren);

attendanceRouter.post("/", takeAttendance);
attendanceRouter.post("/weekly", takeWeeklyAttendance);

attendanceRouter.get(
  "/date/:date",
  getAttendanceByDate
);

attendanceRouter.get(
  "/child/:childId",
  getChildAttendance
);

attendanceRouter.get(
  "/year/:year",
  getAttendanceByYear
);

attendanceRouter.put(
  "/:id",
  updateAttendance
);

attendanceRouter.delete(
  "/:id",
  deleteAttendance
);

export default attendanceRouter;
