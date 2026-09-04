import React, { useContext, useEffect, useState } from "react";
import Navbar from "../Components/Navbar.jsx";
import Waves from "../Components/Waves.jsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";

const Calendar = () => {
  const navigate = useNavigate();

  const { backendUrl, userData } = useContext(AppContent);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const allowedRoles = ["admin", "leader", "pascal", "pamela"];

  const canManageCalendar = userData
    ? Array.isArray(userData.role)
      ? userData.role.some((role) => allowedRoles.includes(role))
      : allowedRoles.includes(userData.role)
    : false;

  // =========================================================
  // EVENT COLOR
  // =========================================================

  const getEventColor = (eventType) => {
    switch (eventType) {
      case "Trip":
        return "#3B82F6";

      case "Visit":
        return "#8B5CF6";

      case "Fasting":
        return "#F59E0B";

      case "Mass":
        return "#EF4444";

      case "Meeting":
        return "#22C55E";

      case "Other":
        return "#6B7280";

      default:
        return "#6B7280";
    }
  };

  const getTypeColor = (eventType) => {
    switch (eventType) {
      case "Trip":
        return "bg-blue-100 text-blue-700";

      case "Visit":
        return "bg-purple-100 text-purple-700";

      case "Fasting":
        return "bg-orange-100 text-orange-700";

      case "Mass":
        return "bg-red-100 text-red-700";

      case "Meeting":
        return "bg-green-100 text-green-700";

      case "Other":
        return "bg-gray-100 text-gray-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // =========================================================
  // FETCH EVENTS
  // =========================================================

  const getEvents = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(
        `${backendUrl}/api/events`
      );

      if (data.success) {
        const calendarEvents = data.events || [];

        const formattedEvents = calendarEvents.map((event) => ({
          id: event._id,

          title: event.title,

          start: event.startDate,

          end: event.endDate || undefined,

          allDay: event.allDay ?? false,

          backgroundColor: getEventColor(event.eventType),

          borderColor: getEventColor(event.eventType),

          extendedProps: {
            description: event.description,
            eventType: event.eventType,
            location: event.location,
            years: event.years,
            createdBy: event.createdBy,
            originalEvent: event,
          },
        }));

        setEvents(formattedEvents);
      } else {
        toast.error(
          data.message || "Failed to load events"
        );
      }
    } catch (error) {
      console.error("Calendar fetch error:", error);

      toast.error(
        error.response?.data?.message ||
          "Failed to load calendar events"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (backendUrl) {
      getEvents();
    }
  }, [backendUrl]);

  // =========================================================
  // EVENT CLICK
  // =========================================================

  const handleEventClick = (info) => {
    const event = info.event;

    setSelectedEvent({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,

      description: event.extendedProps.description,
      eventType: event.extendedProps.eventType,
      location: event.extendedProps.location,
      years: event.extendedProps.years,
      createdBy: event.extendedProps.createdBy,
    });
  };

  // =========================================================
  // DATE / TIME FORMAT
  // =========================================================

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 relative overflow-hidden">
      {/* Background */}
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

      {/* Main Content */}
      <div className="relative z-10 min-h-screen">
        <Navbar />
        <br/>

        <div className="sm:hidden">
          <br />
        </div>

        <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Church Calendar
                </h1>

                <p className="text-gray-500 mt-2">
                  View upcoming church events and activities.
                </p>
              </div>

              {canManageCalendar && (
                <button
                  onClick={() => navigate("/events/Create")}
                  className="
                    bg-[#D4AF37]
                    hover:bg-[#b9952e]
                    text-white
                    font-semibold
                    px-6
                    py-3
                    rounded-xl
                    shadow-md
                    transition
                    duration-200
                  "
                >
                  + Create Event
                </button>
              )}
            </div>

            {/* Event Legend */}

            <div className="flex flex-wrap gap-3 mb-5">
              <Legend color="bg-green-500" label="Meeting" />
              <Legend color="bg-red-500" label="Mass" />
              <Legend color="bg-blue-500" label="Trip" />
              <Legend color="bg-purple-500" label="Visit" />
              <Legend color="bg-orange-500" label="Fasting" />
              <Legend color="bg-gray-500" label="Other" />
            </div>

            {/* Calendar Card */}

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center min-h-[500px]">
                  <div className="text-center">
                    <div
                      className="
                        w-10
                        h-10
                        border-4
                        border-gray-200
                        border-t-[#D4AF37]
                        rounded-full
                        animate-spin
                        mx-auto
                      "
                    />

                    <p className="mt-4 text-gray-500">
                      Loading calendar...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <FullCalendar
                    plugins={[
                      dayGridPlugin,
                      interactionPlugin,
                    ]}
                    initialView="dayGridMonth"
                    events={events}
                    eventClick={handleEventClick}
                    height="auto"
                    headerToolbar={{
                      left: "prev,next",
                      center: "title",
                      right: "",
                    }}
                    eventDisplay="block"
                    displayEventTime={true}
                    dayMaxEvents={3}
                    fixedWeekCount={false}
                  />

                  {events.length === 0 && (
                    <div className="mt-6 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                      No events have been added yet.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* =====================================================
          EVENT DETAILS MODAL
      ====================================================== */}

      {selectedEvent && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/50
            px-4
            backdrop-blur-sm
          "
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="
              bg-white
              rounded-2xl
              shadow-2xl
              w-full
              max-w-lg
              p-6
              sm:p-8
              max-h-[90vh]
              overflow-y-auto
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedEvent.title}
                </h2>

                {selectedEvent.eventType && (
                  <span
                    className={`
                      inline-block
                      mt-3
                      px-3
                      py-1
                      rounded-full
                      text-sm
                      font-semibold
                      ${getTypeColor(
                        selectedEvent.eventType
                      )}
                    `}
                  >
                    {selectedEvent.eventType}
                  </span>
                )}
              </div>

              <button
                onClick={() =>
                  setSelectedEvent(null)
                }
                className="
                  flex
                  items-center
                  justify-center
                  w-9
                  h-9
                  rounded-full
                  text-gray-400
                  hover:text-gray-700
                  hover:bg-gray-100
                  text-2xl
                  transition
                "
              >
                ×
              </button>
            </div>

            {/* Event Details */}

            <div className="mt-7 space-y-5 text-gray-700">
              {/* Start Date */}

              {selectedEvent.start && (
                <Detail title="Date">
                  {formatDate(selectedEvent.start)}
                </Detail>
              )}

              {/* Time */}

              {selectedEvent.allDay ? (
                <Detail title="Time">
                  All day
                </Detail>
              ) : (
                selectedEvent.start && (
                  <Detail title="Time">
                    {formatTime(
                      selectedEvent.start
                    )}

                    {selectedEvent.end &&
                      ` - ${formatTime(
                        selectedEvent.end
                      )}`}
                  </Detail>
                )
              )}

              {/* End Date */}

              {selectedEvent.end &&
                formatDate(selectedEvent.start) !==
                  formatDate(selectedEvent.end) && (
                  <Detail title="End Date">
                    {formatDate(
                      selectedEvent.end
                    )}
                  </Detail>
                )}

              {/* Location */}

              {selectedEvent.location && (
                <Detail title="Location">
                  {selectedEvent.location}
                </Detail>
              )}

              {/* Years */}

              {selectedEvent.years?.length >
                0 && (
                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    Years
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.years.map(
                      (year) => (
                        <span
                          key={year}
                          className="
                            bg-gray-100
                            text-gray-700
                            px-3
                            py-1
                            rounded-lg
                            text-sm
                            font-medium
                          "
                        >
                          Year {year}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Description */}

              {selectedEvent.description && (
                <Detail title="Description">
                  <p className="whitespace-pre-line leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </Detail>
              )}

              {/* Created By */}

              {selectedEvent.createdBy?.name && (
                <Detail title="Created By">
                  {selectedEvent.createdBy.name}
                </Detail>
              )}
            </div>

            {/* Admin Controls */}

            {canManageCalendar && (
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() =>
                    navigate(
                      `/events/edit/${selectedEvent.id}`
                    )
                  }
                  className="
                    flex-1
                    bg-gray-900
                    hover:bg-gray-800
                    text-white
                    py-3
                    rounded-xl
                    font-semibold
                    transition
                  "
                >
                  Edit Event
                </button>
              </div>
            )}

            <button
              onClick={() =>
                setSelectedEvent(null)
              }
              className="
                w-full
                mt-3
                border
                border-gray-300
                hover:bg-gray-50
                py-3
                rounded-xl
                font-semibold
                transition
              "
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================
// LEGEND
// =========================================================

const Legend = ({ color, label }) => {
  return (
    <div
      className="
        flex
        items-center
        gap-2
        bg-white
        border
        border-gray-100
        shadow-sm
        rounded-lg
        px-3
        py-2
        text-sm
      "
    >
      <span
        className={`w-3 h-3 rounded-full ${color}`}
      />

      <span className="text-gray-600">
        {label}
      </span>
    </div>
  );
};

// =========================================================
// DETAIL
// =========================================================

const Detail = ({ title, children }) => {
  return (
    <div>
      <p className="font-semibold text-gray-900">
        {title}
      </p>

      <div className="mt-1">
        {children}
      </div>
    </div>
  );
};

export default Calendar;