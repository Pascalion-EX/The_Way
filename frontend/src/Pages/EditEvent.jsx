import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../Components/Navbar.jsx";
import Waves from "../Components/Waves.jsx";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";

const EditEvent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { backendUrl, userData } = useContext(AppContent);

  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    eventType: "Meeting",
    location: "",
    startDate: "",
    endDate: "",
    allDay: true,
    years: [],
  });

  const allowedManageRoles = ["admin", "leader", "pascal", "pamela"];

  const userRoles = Array.isArray(userData?.role)
    ? userData.role
    : userData?.role
      ? [userData.role]
      : [];

  const canManageEvents = userRoles.some((role) =>
    allowedManageRoles.includes(role)
  );

  // =========================================================
  // FORMAT DATES FOR HTML INPUTS
  // =========================================================

  const pad = (value) => String(value).padStart(2, "0");

  const formatDateForInput = (value, allDay) => {
    if (!value) return "";

    // Already in a browser-friendly input format.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return allDay ? value : `${value}T00:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !value.endsWith("Z")) {
      return allDay ? value.slice(0, 10) : value.slice(0, 16);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());

    if (allDay) {
      return `${year}-${month}-${day}`;
    }

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // =========================================================
  // PERMISSION CHECK
  // =========================================================

  useEffect(() => {
    if (userData && !canManageEvents) {
      toast.error("You do not have permission to edit events.");
      navigate("/calendar", { replace: true });
    }
  }, [userData, canManageEvents, navigate]);

  // =========================================================
  // FETCH EVENT
  // =========================================================

  useEffect(() => {
    const getEvent = async () => {
      if (!backendUrl || !id) return;

      try {
        setFetching(true);

        const { data } = await axios.get(
          `${backendUrl}/api/events/${id}`
        );

        if (!data.success || !data.event) {
          toast.error(data.message || "Failed to load event.");
          navigate("/calendar", { replace: true });
          return;
        }

        const event = data.event;

        setFormData({
          title: event.title || "",
          description: event.description || "",
          eventType: event.eventType || "Meeting",
          location: event.location || "",
          startDate: formatDateForInput(
            event.startDate,
            Boolean(event.allDay)
          ),
          endDate: formatDateForInput(
            event.endDate,
            Boolean(event.allDay)
          ),
          allDay: Boolean(event.allDay),
          years: Array.isArray(event.years)
            ? event.years.map(Number)
            : [],
        });
      } catch (error) {
        console.error("Load event error:", error);

        toast.error(
          error.response?.data?.message ||
            "Failed to load event."
        );

        navigate("/calendar", { replace: true });
      } finally {
        setFetching(false);
      }
    };

    getEvent();
  }, [backendUrl, id, navigate]);

  // =========================================================
  // HANDLE NORMAL INPUT CHANGES
  // =========================================================

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "allDay" && type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        allDay: checked,
        startDate: formatDateForInput(prev.startDate, checked),
        endDate: formatDateForInput(prev.endDate, checked),
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // =========================================================
  // HANDLE YEARS
  // =========================================================

  const handleYearChange = (year) => {
    setFormData((prev) => {
      const alreadySelected = prev.years.includes(year);

      return {
        ...prev,
        years: alreadySelected
          ? prev.years.filter((item) => item !== year)
          : [...prev.years, year].sort((a, b) => a - b),
      };
    });
  };

  // =========================================================
  // SUBMIT UPDATE
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Event title is required");
      return;
    }

    if (!formData.eventType) {
      toast.error("Event type is required");
      return;
    }

    if (!formData.startDate) {
      toast.error("Start date is required");
      return;
    }

    if (
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    ) {
      toast.error("End date cannot be before start date");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        title: formData.title.trim(),
        description: formData.description,
        eventType: formData.eventType,
        location: formData.location,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        allDay: formData.allDay,
        years: formData.years,
      };

      const { data } = await axios.put(
        `${backendUrl}/api/events/${id}`,
        payload
      );

      if (data.success) {
        toast.success("Event updated successfully");
        navigate("/calendar");
      } else {
        toast.error(data.message || "Failed to update event");
      }
    } catch (error) {
      console.error("Update event error:", error);

      toast.error(
        error.response?.data?.message ||
          "Failed to update event"
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (fetching) {
    return (
      <div className="min-h-screen bg-white text-gray-900 relative overflow-hidden">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

          <Waves
            lineColor="#e4b54f7e"
            backgroundColor="rgba(110, 110, 110, 0)"
            waveSpeedX={0.08}
            waveSpeedY={0.03}
            waveAmpX={60}
            waveAmpY={40}
            friction={0.9}
            tension={0.01}
            maxCursorMove={320}
            xGap={10}
            yGap={20}
          />
        </div>

        <div className="relative z-10 min-h-screen">
          <Navbar />

          <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <div className="min-h-[420px] rounded-2xl border border-gray-100 bg-white shadow-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-gray-200 border-t-[#D4AF37] rounded-full animate-spin mx-auto" />
                  <p className="mt-4 text-gray-500">
                    Loading event...
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-screen bg-white text-gray-900 relative overflow-hidden">
      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

        <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(110, 110, 110, 0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={60}
          waveAmpY={40}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      </div>

      {/* =====================================================
          PAGE
      ====================================================== */}

      <div className="relative z-10 min-h-screen">
        <Navbar />

        <div className="sm:hidden">
          <br />
        </div>

        <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => navigate("/calendar")}
              className="
                mb-6
                text-gray-600
                hover:text-gray-900
                font-medium
                transition
              "
            >
              ← Back to Calendar
            </button>

            {/* =================================================
                FORM CARD
            ================================================== */}

            <div
              className="
                bg-white
                rounded-2xl
                shadow-xl
                border
                border-gray-100
                p-6
                sm:p-8
              "
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                  Edit Event
                </h1>

                <p className="text-gray-500 mt-2">
                  Update the selected church calendar event.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* TITLE */}

                <div>
                  <label
                    htmlFor="title"
                    className="block font-medium mb-2"
                  >
                    Event Title
                  </label>

                  <input
                    id="title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Example: Friday Meeting"
                    className="
                      w-full
                      border
                      border-gray-300
                      rounded-xl
                      px-4
                      py-3
                      outline-none
                      transition
                      focus:ring-2
                      focus:ring-[#D4AF37]
                      focus:border-transparent
                    "
                  />
                </div>

                {/* EVENT TYPE */}

                <div>
                  <label
                    htmlFor="eventType"
                    className="block font-medium mb-2"
                  >
                    Event Type
                  </label>

                  <select
                    id="eventType"
                    name="eventType"
                    value={formData.eventType}
                    onChange={handleChange}
                    required
                    className="
                      w-full
                      border
                      border-gray-300
                      rounded-xl
                      px-4
                      py-3
                      bg-white
                      outline-none
                      transition
                      focus:ring-2
                      focus:ring-[#D4AF37]
                      focus:border-transparent
                    "
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Mass">Mass</option>
                    <option value="Trip">Trip</option>
                    <option value="Visit">Visit</option>
                    <option value="Fasting">Fasting</option>
                    <option value="Feast">Feast</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* LOCATION */}

                <div>
                  <label
                    htmlFor="location"
                    className="block font-medium mb-2"
                  >
                    Location
                  </label>

                  <input
                    id="location"
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Example: Church Hall"
                    className="
                      w-full
                      border
                      border-gray-300
                      rounded-xl
                      px-4
                      py-3
                      outline-none
                      transition
                      focus:ring-2
                      focus:ring-[#D4AF37]
                      focus:border-transparent
                    "
                  />
                </div>

                {/* DATES */}

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="startDate"
                      className="block font-medium mb-2"
                    >
                      Start Date
                    </label>

                    <input
                      id="startDate"
                      type={
                        formData.allDay
                          ? "date"
                          : "datetime-local"
                      }
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      required
                      className="
                        w-full
                        border
                        border-gray-300
                        rounded-xl
                        px-4
                        py-3
                        outline-none
                        transition
                        focus:ring-2
                        focus:ring-[#D4AF37]
                        focus:border-transparent
                      "
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="endDate"
                      className="block font-medium mb-2"
                    >
                      End Date
                    </label>

                    <input
                      id="endDate"
                      type={
                        formData.allDay
                          ? "date"
                          : "datetime-local"
                      }
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleChange}
                      className="
                        w-full
                        border
                        border-gray-300
                        rounded-xl
                        px-4
                        py-3
                        outline-none
                        transition
                        focus:ring-2
                        focus:ring-[#D4AF37]
                        focus:border-transparent
                      "
                    />
                  </div>
                </div>

                {/* ALL DAY */}

                <div
                  className="
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    p-4
                  "
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="allDay"
                      checked={formData.allDay}
                      onChange={handleChange}
                      className="
                        w-5
                        h-5
                        accent-[#D4AF37]
                      "
                    />

                    <div>
                      <p className="font-medium text-gray-900">
                        All-day event
                      </p>

                      <p className="text-sm text-gray-500">
                        Disable this to specify the start
                        and end time.
                      </p>
                    </div>
                  </label>
                </div>

                {/* YEARS */}

                <div>
                  <label className="block font-medium mb-2">
                    Years
                  </label>

                  <p className="text-sm text-gray-500 mb-3">
                    Select the church years this event is
                    intended for.
                  </p>

                  <div
                    className="
                      grid
                      grid-cols-3
                      sm:grid-cols-4
                      md:grid-cols-6
                      gap-2
                    "
                  >
                    {Array.from(
                      { length: 12 },
                      (_, index) => index + 1
                    ).map((year) => {
                      const selected =
                        formData.years.includes(year);

                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() =>
                            handleYearChange(year)
                          }
                          className={`
                            rounded-xl
                            border
                            px-3
                            py-2
                            font-medium
                            transition
                            ${
                              selected
                                ? "border-[#D4AF37] bg-[#D4AF37] text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            }
                          `}
                        >
                          Year {year}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DESCRIPTION */}

                <div>
                  <label
                    htmlFor="description"
                    className="block font-medium mb-2"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="5"
                    placeholder="Event details..."
                    className="
                      w-full
                      border
                      border-gray-300
                      rounded-xl
                      px-4
                      py-3
                      outline-none
                      resize-none
                      transition
                      focus:ring-2
                      focus:ring-[#D4AF37]
                      focus:border-transparent
                    "
                  />
                </div>

                {/* BUTTONS */}

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/calendar")
                    }
                    disabled={saving}
                    className="
                      flex-1
                      border
                      border-gray-300
                      hover:bg-gray-50
                      disabled:opacity-50
                      py-3
                      rounded-xl
                      font-semibold
                      transition
                    "
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="
                      flex-1
                      bg-[#D4AF37]
                      hover:bg-[#b9952e]
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                      text-white
                      py-3
                      rounded-xl
                      font-semibold
                      transition
                    "
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditEvent;
