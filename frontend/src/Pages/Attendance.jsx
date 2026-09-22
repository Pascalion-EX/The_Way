import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Save,
  Search,
  Users,
  XCircle,
  CircleHelp,
} from "lucide-react";
import { toast } from "react-toastify";

import { AppContent } from "../Context/AppContext.jsx";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";

// ======================================================
// HELPERS
// ======================================================

// Format JS Date as YYYY-MM-DD without UTC shifting the date
const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Get this Wednesday if today is Wednesday,
// otherwise get the next Wednesday.
const getNextWednesday = () => {
  const today = new Date();
  const day = today.getDay();

  const daysUntilWednesday = (3 - day + 7) % 7;

  today.setDate(today.getDate() + daysUntilWednesday);

  return formatDateInput(today);
};

const isWednesday = (dateString) => {
  if (!dateString) return false;

  const date = new Date(`${dateString}T00:00:00Z`);

  return date.getUTCDay() === 3;
};

const formatDisplayDate = (dateString) => {
  if (!dateString) return "";

  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const getChildGrade = (child) => {
  return (
    child.grade ||
    child.class ||
    child.year ||
    child.schoolYear ||
    "Unassigned"
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================

const Attendance = () => {
  const { backendUrl, userData } = useContext(AppContent);

  const [serviceDate, setServiceDate] = useState(getNextWednesday());

  const [children, setChildren] = useState([]);

  /*
    Structure:

    {
      childId: {
        child: "childId",
        status: "present",
        notes: ""
      }
    }
  */
  const [attendanceRecords, setAttendanceRecords] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  // ======================================================
  // PERMISSIONS
  // ======================================================

  const allowedRoles = ["admin", "leader", "pascal", "pamela"];

  const userRoles = userData
    ? Array.isArray(userData.role)
      ? userData.role.map((role) => String(role).toLowerCase())
      : [String(userData.role).toLowerCase()]
    : [];

  const canTakeAttendance = userRoles.some((role) =>
    allowedRoles.includes(role)
  );

  // ======================================================
  // FETCH CHILDREN + SAVED ATTENDANCE
  // ======================================================

  const fetchAttendancePage = async (date = serviceDate) => {
    if (!isWednesday(date)) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [childrenResponse, attendanceResponse] = await Promise.all([
        axios.get(`${backendUrl}/api/children`, {
          withCredentials: true,
        }),

        axios.get(`${backendUrl}/api/attendance/date/${date}`, {
          withCredentials: true,
        }),
      ]);

      // Support a few common response names
      const childrenData =
        childrenResponse.data.children ||
        childrenResponse.data.childProfiles ||
        childrenResponse.data.profiles ||
        childrenResponse.data.data ||
        [];

      const existingAttendance =
        attendanceResponse.data.attendance || [];

      setChildren(childrenData);

      /*
        Default every child to absent.

        This prevents accidentally marking every child present
        just by opening the page and clicking save.

        Existing attendance records override this default.
      */

      const initialRecords = {};

      childrenData.forEach((child) => {
        initialRecords[child._id] = {
          child: child._id,
          status: "absent",
          notes: "",
        };
      });

      existingAttendance.forEach((record) => {
        const childId =
          typeof record.child === "object"
            ? record.child?._id
            : record.child;

        if (!childId) return;

        initialRecords[childId] = {
          child: childId,
          status: record.status || "absent",
          notes: record.notes || "",
        };
      });

      setAttendanceRecords(initialRecords);
    } catch (error) {
      console.error("Attendance loading error:", error);

      toast.error(
        error.response?.data?.message ||
          "Failed to load attendance information."
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // LOAD WHEN DATE CHANGES
  // ======================================================

  useEffect(() => {
    if (isWednesday(serviceDate)) {
      fetchAttendancePage(serviceDate);
    } else {
      setLoading(false);
    }
  }, [serviceDate]);

  // ======================================================
  // UPDATE ONE CHILD
  // ======================================================

  const updateAttendance = (childId, field, value) => {
    setAttendanceRecords((previous) => ({
      ...previous,

      [childId]: {
        ...previous[childId],
        child: childId,
        [field]: value,
      },
    }));
  };

  // ======================================================
  // MARK EVERYONE
  // ======================================================

  const markAll = (status) => {
    setAttendanceRecords((previous) => {
      const updated = { ...previous };

      children.forEach((child) => {
        updated[child._id] = {
          ...updated[child._id],
          child: child._id,
          status,
        };
      });

      return updated;
    });
  };

  // ======================================================
  // SAVE ATTENDANCE
  // ======================================================

  const saveAttendance = async () => {
    if (!serviceDate) {
      toast.error("Please select a service date.");
      return;
    }

    if (!isWednesday(serviceDate)) {
      toast.error("Attendance can only be taken for Wednesday services.");
      return;
    }

    if (children.length === 0) {
      toast.error("There are no children to save.");
      return;
    }

    try {
      setSaving(true);

      const attendance = children.map((child) => ({
        child: child._id,

        status:
          attendanceRecords[child._id]?.status || "absent",

        notes:
          attendanceRecords[child._id]?.notes || "",
      }));

      const { data } = await axios.post(
        `${backendUrl}/api/attendance/weekly`,
        {
          serviceDate,
          attendance,
        },
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        toast.success(
          data.message || "Attendance recorded successfully."
        );

        // Reload saved database values
        await fetchAttendancePage(serviceDate);
      } else {
        toast.error(data.message || "Failed to save attendance.");
      }
    } catch (error) {
      console.error("Save attendance error:", error);

      toast.error(
        error.response?.data?.message ||
          "Failed to save attendance."
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // FILTER GRADES
  // ======================================================

  const grades = useMemo(() => {
    const uniqueGrades = [
      ...new Set(
        children
          .map((child) => getChildGrade(child))
          .filter(Boolean)
      ),
    ];

    return uniqueGrades.sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        numeric: true,
      })
    );
  }, [children]);

  // ======================================================
  // FILTER CHILDREN
  // ======================================================

  const filteredChildren = useMemo(() => {
    return children.filter((child) => {
      const name =
        child.name ||
        child.childName ||
        `${child.firstName || ""} ${child.lastName || ""}`.trim();

      const matchesSearch = name
        .toLowerCase()
        .includes(search.toLowerCase());

      const childGrade = String(getChildGrade(child));

      const matchesGrade =
        gradeFilter === "all" ||
        childGrade === gradeFilter;

      return matchesSearch && matchesGrade;
    });
  }, [children, search, gradeFilter]);

  // ======================================================
  // STATISTICS
  // ======================================================

  const stats = useMemo(() => {
    const records = Object.values(attendanceRecords);

    return {
      total: children.length,

      present: records.filter(
        (record) => record.status === "present"
      ).length,

      absent: records.filter(
        (record) => record.status === "absent"
      ).length,

      late: records.filter(
        (record) => record.status === "late"
      ).length,

      excused: records.filter(
        (record) => record.status === "excused"
      ).length,
    };
  }, [attendanceRecords, children]);

  // ======================================================
  // ACCESS DENIED
  // ======================================================

  if (userData && !canTakeAttendance) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">
        <div className="pointer-events-none absolute inset-0 z-0">
          <Waves
            lineColor="#e4b54f7e"
            backgroundColor="rgba(255,255,255,0)"
            waveSpeedX={0.08}
            waveSpeedY={0.03}
            waveAmpX={40}
            waveAmpY={20}
            friction={0.9}
            tension={0.01}
            maxCursorMove={320}
            xGap={10}
            yGap={20}
          />
        </div>

        <Navbar />

        <div className="relative z-10 flex min-h-[80vh] items-center justify-center px-6 pt-28">
          <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-3xl font-bold text-gray-900">
              Access Denied
            </h1>

            <p className="mt-3 text-gray-600">
              You do not have permission to take attendance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(255,255,255,0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      </div>

      <Navbar />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-36 sm:px-6 lg:px-8">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <section className="mb-8">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-500">
                  Weekly Service
                </p>

                <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
                  Attendance
                </h1>

                <p className="mt-3 max-w-2xl text-gray-600">
                  Record attendance for the Wednesday service.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-[#D4AF37]/10 px-5 py-4 text-[#9a791c]">
                <CalendarDays size={26} />

                <div>
                  <p className="text-xs font-semibold uppercase">
                    Service Date
                  </p>

                  <p className="font-bold">
                    {formatDisplayDate(serviceDate)}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* DATE */}
        {/* ================================================= */}

        <section className="mb-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6">

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Wednesday Service Date
              </label>

              <input
                type="date"
                value={serviceDate}
                onChange={(event) =>
                  setServiceDate(event.target.value)
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-300
                  bg-white
                  px-4
                  py-3
                  outline-none
                  transition
                  focus:border-[#D4AF37]
                  focus:ring-2
                  focus:ring-[#D4AF37]/20
                "
              />

              {serviceDate && !isWednesday(serviceDate) && (
                <p className="mt-2 text-sm font-medium text-red-500">
                  Please select a Wednesday.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Grade
              </label>

              <select
                value={gradeFilter}
                onChange={(event) =>
                  setGradeFilter(event.target.value)
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-300
                  bg-white
                  px-4
                  py-3
                  outline-none
                  transition
                  focus:border-[#D4AF37]
                  focus:ring-2
                  focus:ring-[#D4AF37]/20
                "
              >
                <option value="all">All Grades</option>

                {grades.map((grade) => (
                  <option key={grade} value={String(grade)}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </section>

        {/* ================================================= */}
        {/* STATS */}
        {/* ================================================= */}

        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">

          <StatCard
            title="Children"
            value={stats.total}
            icon={<Users size={20} />}
          />

          <StatCard
            title="Present"
            value={stats.present}
            icon={<CheckCircle2 size={20} />}
          />

          <StatCard
            title="Absent"
            value={stats.absent}
            icon={<XCircle size={20} />}
          />

          <StatCard
            title="Late"
            value={stats.late}
            icon={<Clock3 size={20} />}
          />

          <StatCard
            title="Excused"
            value={stats.excused}
            icon={<CircleHelp size={20} />}
          />

        </section>

        {/* ================================================= */}
        {/* ATTENDANCE CARD */}
        {/* ================================================= */}

        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-xl sm:p-6">

          {/* Toolbar */}

          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Children
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {filteredChildren.length} children shown
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              {/* Search */}

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  placeholder="Search child..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-300
                    py-2.5
                    pl-10
                    pr-4
                    outline-none
                    focus:border-[#D4AF37]
                    sm:w-64
                  "
                />
              </div>

              <button
                onClick={() => markAll("present")}
                className="rounded-xl bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-200"
              >
                Mark All Present
              </button>

              <button
                onClick={() => markAll("absent")}
                className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-200"
              >
                Mark All Absent
              </button>

            </div>
          </div>

          {/* ================================================= */}
          {/* LOADING */}
          {/* ================================================= */}

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">

              <div className="text-center">
                <Loader2
                  size={36}
                  className="mx-auto animate-spin text-[#D4AF37]"
                />

                <p className="mt-3 text-gray-500">
                  Loading attendance...
                </p>
              </div>

            </div>
          ) : !isWednesday(serviceDate) ? (
            <div className="py-16 text-center text-gray-500">
              Select a Wednesday to take attendance.
            </div>
          ) : filteredChildren.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              No children found.
            </div>
          ) : (
            <div className="space-y-3">

              {filteredChildren.map((child) => {
                const record =
                  attendanceRecords[child._id] || {};

                const childName =
                  child.name ||
                  child.childName ||
                  `${child.firstName || ""} ${
                    child.lastName || ""
                  }`.trim() ||
                  "Unnamed Child";

                return (
                  <div
                    key={child._id}
                    className="
                      rounded-2xl
                      border
                      border-gray-200
                      p-4
                      transition
                      hover:border-[#D4AF37]/40
                      hover:shadow-md
                    "
                  >

                    <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)] lg:items-center">

                      {/* CHILD */}

                      <div className="flex items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 font-bold text-[#9a791c]">
                          {childName.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {childName}
                          </h3>

                          <p className="text-sm text-gray-500">
                            {getChildGrade(child)}
                          </p>
                        </div>

                      </div>

                      {/* STATUS */}

                      <div className="flex flex-wrap gap-2">

                        <StatusButton
                          active={record.status === "present"}
                          onClick={() =>
                            updateAttendance(
                              child._id,
                              "status",
                              "present"
                            )
                          }
                          label="Present"
                          activeClass="bg-green-500 border-green-500 text-white"
                        />

                        <StatusButton
                          active={record.status === "absent"}
                          onClick={() =>
                            updateAttendance(
                              child._id,
                              "status",
                              "absent"
                            )
                          }
                          label="Absent"
                          activeClass="bg-red-500 border-red-500 text-white"
                        />

                        <StatusButton
                          active={record.status === "late"}
                          onClick={() =>
                            updateAttendance(
                              child._id,
                              "status",
                              "late"
                            )
                          }
                          label="Late"
                          activeClass="bg-orange-500 border-orange-500 text-white"
                        />

                        <StatusButton
                          active={record.status === "excused"}
                          onClick={() =>
                            updateAttendance(
                              child._id,
                              "status",
                              "excused"
                            )
                          }
                          label="Excused"
                          activeClass="bg-blue-500 border-blue-500 text-white"
                        />

                      </div>

                      {/* NOTES */}

                      <input
                        type="text"
                        placeholder="Notes..."
                        value={record.notes || ""}
                        onChange={(event) =>
                          updateAttendance(
                            child._id,
                            "notes",
                            event.target.value
                          )
                        }
                        className="
                          w-full
                          rounded-xl
                          border
                          border-gray-300
                          px-3
                          py-2
                          text-sm
                          outline-none
                          transition
                          focus:border-[#D4AF37]
                        "
                      />

                    </div>

                  </div>
                );
              })}

            </div>
          )}

          {/* ================================================= */}
          {/* SAVE */}
          {/* ================================================= */}

          {!loading &&
            isWednesday(serviceDate) &&
            children.length > 0 && (
              <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">

                <button
                  onClick={saveAttendance}
                  disabled={saving}
                  className="
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#D4AF37]
                    px-6
                    py-3
                    font-semibold
                    text-white
                    shadow-md
                    transition
                    hover:bg-[#b9952e]
                    hover:shadow-lg
                    active:scale-95
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={20}
                        className="animate-spin"
                      />

                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={20} />

                      Save Attendance
                    </>
                  )}
                </button>

              </div>
            )}

        </section>

      </main>
    </div>
  );
};

// ======================================================
// STATUS BUTTON
// ======================================================

const StatusButton = ({
  active,
  onClick,
  label,
  activeClass,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-lg
        border
        px-3
        py-2
        text-xs
        font-semibold
        transition
        ${
          active
            ? activeClass
            : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
        }
      `}
    >
      {label}
    </button>
  );
};

// ======================================================
// STAT CARD
// ======================================================

const StatCard = ({ title, value, icon }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg sm:p-5">

      <div className="flex items-center justify-between">

        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>

        <span className="text-gray-400">
          {icon}
        </span>

      </div>

      <h3 className="mt-2 text-3xl font-bold text-gray-900">
        {value}
      </h3>

    </div>
  );
};

export default Attendance;