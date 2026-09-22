import Attendance from "../models/attendanceModel.js";
import childProfilemodel from "../models/childProfileModel.js";

// ======================================================
// HELPER: CHECK IF DATE IS WEDNESDAY
// ======================================================
const isWednesday = (date) => {
  // 0 = Sunday
  // 1 = Monday
  // 2 = Tuesday
  // 3 = Wednesday
  // 4 = Thursday
  // 5 = Friday
  // 6 = Saturday

  return date.getUTCDay() === 3;
};

// ======================================================
// HELPER: NORMALIZE DATE
// ======================================================
const normalizeServiceDate = (dateInput) => {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Store attendance consistently at midnight UTC
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

// ======================================================
// TAKE ATTENDANCE FOR ONE CHILD
// ======================================================
export const takeAttendance = async (req, res) => {
  try {
    const { child, serviceDate, status, notes } = req.body;

    const recordedBy = req.userId;

    if (!child || !serviceDate) {
      return res.status(400).json({
        success: false,
        message: "Child and service date are required",
      });
    }

    if (!recordedBy) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const normalizedDate = normalizeServiceDate(serviceDate);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid service date",
      });
    }

    // Attendance should only be taken on Wednesday
    if (!isWednesday(normalizedDate)) {
      return res.status(400).json({
        success: false,
        message: "Attendance can only be taken for Wednesday services",
      });
    }

    // Make sure child exists
    const childExists = await childProfilemodel.findById(child);

    if (!childExists) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    const serviceYear = normalizedDate.getUTCFullYear();

    /*
      We use findOneAndUpdate + upsert.

      If attendance already exists for this child/date:
      -> update it

      If it does not exist:
      -> create it
    */

    const attendance = await Attendance.findOneAndUpdate(
      {
        child,
        serviceDate: normalizedDate,
      },
      {
        child,
        serviceDate: normalizedDate,
        serviceYear,
        status: status || "present",
        recordedBy,
        notes: notes || "",
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).populate("child");

    return res.status(200).json({
      success: true,
      message: "Attendance recorded successfully",
      attendance,
    });
  } catch (error) {
    console.error("Take attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// TAKE ATTENDANCE FOR MULTIPLE CHILDREN
// ======================================================
export const takeWeeklyAttendance = async (req, res) => {
  try {
    const { serviceDate, attendance } = req.body;

    const recordedBy = req.userId;

    if (!recordedBy) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!serviceDate) {
      return res.status(400).json({
        success: false,
        message: "Service date is required",
      });
    }

    if (!Array.isArray(attendance) || attendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance list is required",
      });
    }

    const normalizedDate = normalizeServiceDate(serviceDate);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid service date",
      });
    }

    if (!isWednesday(normalizedDate)) {
      return res.status(400).json({
        success: false,
        message: "Attendance can only be taken for Wednesday services",
      });
    }

    const serviceYear = normalizedDate.getUTCFullYear();

    // Extract all child IDs sent by frontend
    const childIds = attendance.map((item) => item.child);

    // Verify that all children actually exist
    const children = await childProfilemodel.find({
      _id: { $in: childIds },
    });

    if (children.length !== childIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more child profiles were not found",
      });
    }

    /*
      bulkWrite is useful here because we may have:

      50 children
      100 children
      200 children

      Instead of making 200 separate database calls,
      MongoDB handles them together.
    */

    const operations = attendance.map((item) => ({
      updateOne: {
        filter: {
          child: item.child,
          serviceDate: normalizedDate,
        },

        update: {
          $set: {
            child: item.child,
            serviceDate: normalizedDate,
            serviceYear,
            status: item.status || "present",
            recordedBy,
            notes: item.notes || "",
          },
        },

        upsert: true,
      },
    }));

    await Attendance.bulkWrite(operations);

    const savedAttendance = await Attendance.find({
      serviceDate: normalizedDate,
    })
      .populate("child")
      .populate("recordedBy", "name");

    return res.status(200).json({
      success: true,
      message: "Weekly attendance recorded successfully",
      count: savedAttendance.length,
      attendance: savedAttendance,
    });
  } catch (error) {
    console.error("Weekly attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET ATTENDANCE FOR ONE WEDNESDAY
// ======================================================
export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const normalizedDate = normalizeServiceDate(date);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const attendance = await Attendance.find({
      serviceDate: normalizedDate,
    })
      .populate("child")
      .populate("recordedBy", "name")
      .sort({ status: 1 });

    return res.status(200).json({
      success: true,
      serviceDate: normalizedDate,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance by date error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET ALL ATTENDANCE FOR ONE CHILD
// ======================================================
export const getChildAttendance = async (req, res) => {
  try {
    const { childId } = req.params;
    const { year } = req.query;

    const child = await childProfilemodel.findById(childId);

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    const filter = {
      child: childId,
    };

    if (year) {
      filter.serviceYear = Number(year);
    }

    const attendance = await Attendance.find(filter)
      .populate("recordedBy", "name")
      .sort({ serviceDate: -1 });

    return res.status(200).json({
      success: true,
      child,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get child attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET ATTENDANCE BY SERVICE YEAR
// ======================================================
export const getAttendanceByYear = async (req, res) => {
  try {
    const { year } = req.params;

    const serviceYear = Number(year);

    if (Number.isNaN(serviceYear)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service year",
      });
    }

    const attendance = await Attendance.find({
      serviceYear,
    })
      .populate("child")
      .populate("recordedBy", "name")
      .sort({ serviceDate: -1 });

    return res.status(200).json({
      success: true,
      serviceYear,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get attendance by year error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// UPDATE ATTENDANCE
// ======================================================
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const attendance = await Attendance.findByIdAndUpdate(
      id,
      {
        status,
        notes,
        recordedBy: req.userId,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("child")
      .populate("recordedBy", "name");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      attendance,
    });
  } catch (error) {
    console.error("Update attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// DELETE ATTENDANCE RECORD
// ======================================================
export const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findByIdAndDelete(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Delete attendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};