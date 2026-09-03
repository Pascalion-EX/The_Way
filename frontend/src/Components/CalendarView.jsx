import React, { useContext, useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import axios from "../utils/axios";
import { AppContent } from "../Context/AppContext.jsx";
import { toast } from "react-toastify";

const CalendarView = () => {
  const { backendUrl } = useContext(AppContent);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

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
        const formattedEvents = data.events.map((event) => ({
          id: event._id,

          title: event.title,

          start: event.startDate,

          end: event.endDate || undefined,

          allDay: event.allDay,

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
          data.message || "Failed to load calendar events"
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
  // EVENT COLORS
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

  const getTypeStyle = (eventType) => {
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
  // DATE FORMAT
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

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="w-full">
        <div
          className="
            min-h-[550px]
            rounded-2xl
            border
            border-gray-200
            bg-white
            flex
            items-center
            justify-center
            shadow-sm
          "
        >
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
      </div>
    );
  }

  // =========================================================
  // CALENDAR
  // =========================================================

  return (
    <>
      <div className="w-full">
        <div
          className="
            rounded-2xl
            border
            border-gray-200
            bg-white
            p-4
            sm:p-6
            shadow-lg
          "
        >
          {/* ================= HEADER ================= */}

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Church Calendar
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View meetings, masses, trips, visits and other
              church events.
            </p>
          </div>

          {/* ================= LEGEND ================= */}

          <div
            className="
              mb-6
              flex
              flex-wrap
              gap-3
              text-sm
            "
          >
            <Legend
              color="bg-green-500"
              label="Meeting"
            />

            <Legend
              color="bg-red-500"
              label="Mass"
            />

            <Legend
              color="bg-blue-500"
              label="Trip"
            />

            <Legend
              color="bg-purple-500"
              label="Visit"
            />

            <Legend
              color="bg-orange-500"
              label="Fasting"
            />

            <Legend
              color="bg-gray-500"
              label="Other"
            />
          </div>

          {/* ================= FULL CALENDAR ================= */}

          <div className="calendar-container">
            <FullCalendar
              plugins={[
                dayGridPlugin,
                interactionPlugin,
              ]}
              initialView="dayGridMonth"
              events={events}
              eventClick={handleEventClick}
              height="auto"
              fixedWeekCount={false}
              dayMaxEvents={3}
              eventDisplay="block"
              displayEventTime={true}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              buttonText={{
                today: "Today",
              }}
            />
          </div>

          {/* ================= EMPTY STATE ================= */}

          {events.length === 0 && (
            <div
              className="
                mt-6
                rounded-xl
                bg-gray-50
                p-6
                text-center
                text-gray-500
              "
            >
              No events have been added yet.
            </div>
          )}
        </div>
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
              w-full
              max-w-lg
              rounded-2xl
              bg-white
              p-6
              shadow-2xl
              sm:p-8
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* ================= MODAL HEADER ================= */}

            <div
              className="
                flex
                items-start
                justify-between
                gap-4
              "
            >
              <div>
                <h2
                  className="
                    text-2xl
                    font-bold
                    text-gray-900
                  "
                >
                  {selectedEvent.title}
                </h2>

                {selectedEvent.eventType && (
                  <span
                    className={`
                      mt-3
                      inline-block
                      rounded-full
                      px-3
                      py-1
                      text-sm
                      font-semibold
                      ${getTypeStyle(
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
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-full
                  text-2xl
                  text-gray-400
                  transition
                  hover:bg-gray-100
                  hover:text-gray-700
                "
              >
                ×
              </button>
            </div>

            {/* ================= DETAILS ================= */}

            <div className="mt-7 space-y-5">
              {/* DATE */}

              <DetailItem title="Date">
                <p>
                  {formatDate(selectedEvent.start)}
                </p>
              </DetailItem>

              {/* TIME */}

              {!selectedEvent.allDay && (
                <DetailItem title="Time">
                  <p>
                    {formatTime(
                      selectedEvent.start
                    )}

                    {selectedEvent.end &&
                      ` - ${formatTime(
                        selectedEvent.end
                      )}`}
                  </p>
                </DetailItem>
              )}

              {/* ALL DAY */}

              {selectedEvent.allDay && (
                <DetailItem title="Time">
                  <p>All day</p>
                </DetailItem>
              )}

              {/* END DATE */}

              {selectedEvent.end &&
                formatDate(selectedEvent.start) !==
                  formatDate(selectedEvent.end) && (
                  <DetailItem title="End Date">
                    <p>
                      {formatDate(
                        selectedEvent.end
                      )}
                    </p>
                  </DetailItem>
                )}

              {/* LOCATION */}

              {selectedEvent.location && (
                <DetailItem title="Location">
                  <p>
                    {selectedEvent.location}
                  </p>
                </DetailItem>
              )}

              {/* YEARS */}

              {selectedEvent.years?.length >
                0 && (
                <DetailItem title="Years">
                  <div
                    className="
                      flex
                      flex-wrap
                      gap-2
                    "
                  >
                    {selectedEvent.years.map(
                      (year) => (
                        <span
                          key={year}
                          className="
                            rounded-lg
                            bg-gray-100
                            px-3
                            py-1
                            text-sm
                            font-medium
                            text-gray-700
                          "
                        >
                          Year {year}
                        </span>
                      )
                    )}
                  </div>
                </DetailItem>
              )}

              {/* DESCRIPTION */}

              {selectedEvent.description && (
                <DetailItem title="Description">
                  <p
                    className="
                      whitespace-pre-line
                      leading-relaxed
                    "
                  >
                    {
                      selectedEvent.description
                    }
                  </p>
                </DetailItem>
              )}

              {/* CREATED BY */}

              {selectedEvent.createdBy?.name && (
                <DetailItem title="Created By">
                  <p>
                    {
                      selectedEvent.createdBy
                        .name
                    }
                  </p>
                </DetailItem>
              )}
            </div>

            {/* ================= CLOSE ================= */}

            <div className="mt-8">
              <button
                onClick={() =>
                  setSelectedEvent(null)
                }
                className="
                  w-full
                  rounded-xl
                  bg-[#D4AF37]
                  px-5
                  py-3
                  font-semibold
                  text-white
                  transition
                  hover:bg-[#b9952e]
                "
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// =========================================================
// LEGEND COMPONENT
// =========================================================

const Legend = ({ color, label }) => {
  return (
    <div
      className="
        flex
        items-center
        gap-2
        rounded-lg
        bg-gray-50
        px-3
        py-2
      "
    >
      <span
        className={`h-3 w-3 rounded-full ${color}`}
      />

      <span className="text-gray-600">
        {label}
      </span>
    </div>
  );
};

// =========================================================
// DETAIL COMPONENT
// =========================================================

const DetailItem = ({ title, children }) => {
  return (
    <div>
      <p
        className="
          mb-1
          text-sm
          font-semibold
          uppercase
          tracking-wide
          text-gray-400
        "
      >
        {title}
      </p>

      <div className="text-gray-700">
        {children}
      </div>
    </div>
  );
};

export default CalendarView;