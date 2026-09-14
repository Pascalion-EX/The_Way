import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, X, Trash2 } from "lucide-react";
import axios from "axios";
import CalendarView from "./CalendarView.jsx";

const CalendarFloatingButton = () => {
  const navigate = useNavigate();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  const handleCalendarClick = () => {
    // Tailwind md breakpoint = 768px
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      navigate("/calendar");
    } else {
      setCalendarOpen(true);
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent) {
      alert("Please select an event first.");
      return;
    }

    const eventId = selectedEvent._id || selectedEvent.id;

    if (!eventId) {
      alert("Event ID not found.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedEvent.title}"?`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const response = await axios.delete(
        `${backendUrl}/api/events/${eventId}`,
        {
          withCredentials: true,
        }
      );

      if (response.data.success) {
        setSelectedEvent(null);

        // Forces CalendarView to reload
        setRefreshKey((previous) => previous + 1);

        alert("Event deleted successfully.");
      }
    } catch (error) {
      console.error("Delete event error:", error);

      alert(
        error.response?.data?.message ||
          "Failed to delete event. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  const closeCalendar = () => {
    setCalendarOpen(false);
    setSelectedEvent(null);
  };

  return (
    <>
      {/* Floating Calendar Button */}
      <button
        onClick={handleCalendarClick}
        className="
          fixed
          bottom-6
          right-6
          z-50
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          bg-[#D6C28A]
          text-white
          shadow-lg
          transition
          duration-200
          hover:scale-110
          hover:bg-[#C9A227]
        "
        aria-label="Open calendar"
      >
        <CalendarDays size={26} />
      </button>

      {/* Desktop Calendar Modal */}
      {calendarOpen && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            hidden
            items-center
            justify-center
            bg-black/40
            p-6
            backdrop-blur-sm
            md:flex
          "
          onClick={closeCalendar}
        >
          <div
            className="
              relative
              max-h-[90vh]
              w-full
              max-w-5xl
              overflow-y-auto
              rounded-2xl
              bg-white
              p-6
              shadow-2xl
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeCalendar}
              className="
                absolute
                right-4
                top-4
                z-10
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                bg-gray-100
                text-gray-600
                transition
                hover:bg-gray-200
                hover:text-gray-900
              "
              aria-label="Close calendar"
            >
              <X size={20} />
            </button>

            <div className="mb-5 pr-14">
              <h2 className="text-2xl font-bold text-gray-900">
                Church Calendar
              </h2>

              <p className="text-sm text-gray-500">
                Trips, camps, meetings, masses, visits and fasting events
              </p>
            </div>

            {/* Selected Event */}
            {selectedEvent && (
              <div
                className="
                  mb-5
                  flex
                  items-center
                  justify-between
                  gap-4
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  p-4
                "
              >
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Selected event
                  </p>

                  <h3 className="font-semibold text-gray-900">
                    {selectedEvent.title}
                  </h3>
                </div>

                {/* Delete Button */}
                <button
                  onClick={deleteEvent}
                  disabled={deleting}
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-red-500
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-white
                    transition
                    hover:bg-red-600
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  <Trash2 size={18} />

                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}

            {/* Calendar */}
            <CalendarView
              key={refreshKey}
              onEventSelect={setSelectedEvent}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarFloatingButton;