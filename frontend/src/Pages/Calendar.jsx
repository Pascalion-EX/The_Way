import React from "react";
import Navbar from "../Components/Navbar.jsx";
import CalendarView from "../Components/CalendarView.jsx";

const Calendar = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
        <br></br>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Church Calendar
          </h1>

          <p className="mt-1 text-gray-500">
            View upcoming church events and activities.
          </p>
        </div>

        <CalendarView />
      </main>
    </div>
  );
};

export default Calendar;