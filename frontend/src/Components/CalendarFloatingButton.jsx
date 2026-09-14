import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, X } from "lucide-react";
import CalendarView from "./CalendarView.jsx";

const CalendarFloatingButton = () => {
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleCalendarClick = () => {
    // Tailwind md breakpoint = 768px
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      navigate("/calendar");
    } else {
      setCalendarOpen(true);
    }
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
          onClick={() => setCalendarOpen(false)}
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
            {/* Close */}
            <button
              onClick={() => setCalendarOpen(false)}
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
            >
              <X size={20} />
            </button>

            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-900">
                Church Calendar
              </h2>

              <p className="text-sm text-gray-500">
                Trips, camps, meetings, masses, visits and fasting events
              </p>
            </div>

            <CalendarView />
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarFloatingButton;