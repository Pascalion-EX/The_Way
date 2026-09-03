import React from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./Pages/Login";
import Home from "./Pages/Home";
import Calendar from "./Pages/Calendar.jsx";
import Lessons from "./Pages/Lessons";
import EmailVerify from "./Pages/EmailVerify";
import ResetPassword from "./Pages/ResetPassword";
import CreateLesson from "./Pages/CreateLesson";
import LessonViewer from "./Pages/LessonViewer";
import EditLesson from "./Pages/EditLesson.jsx";
import Camp from "./Pages/Camps.jsx";
import CreateCamp from "./Pages/Createcamp.jsx";
import Games from "./Pages/Games.jsx";
import Chants from "./Pages/Chants.jsx";
import ChantViewer from "./Pages/ChantViewer.jsx";
import CreateChant from "./Pages/CreateChant.jsx";
import EditChant from "./Pages/EditChant.jsx";
import CampDetails from "./Pages/CampDetails.jsx";
import Profile from "./Pages/Profile.jsx";
import Admin from "./Pages/Admin.jsx";
import Activities from "./Pages/Activities.jsx";
import CreateGame from "./Pages/Creategame.jsx";
import Info from "./Pages/Info.jsx";
import GameViewer from "./Pages/GamesViewer.jsx";
import CreateEvent from "./Pages/CreateEvent";

import ProtectedRoute from "./Components/ProtectedRoute.jsx";
import CalendarFloatingButton from "./Components/CalendarFloatingButton.jsx";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/*
  Layout used after authentication.

  Everything rendered inside this layout will automatically
  have access to the floating calendar button.
*/
const ProtectedLayout = () => {
  return (
    <>
      <Outlet />

      {/* Floating calendar/support-style button */}
      <CalendarFloatingButton />
    </>
  );
};

const App = () => {
  return (
    <>
      <ToastContainer />

      <Routes>
        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route path="/login" element={<Login />} />

        <Route
          path="/email-verify"
          element={<EmailVerify />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        {/* =========================
            PROTECTED ROUTES
        ========================== */}
        
        <Route element={<ProtectedRoute />}>
          {/* 
            Everything inside ProtectedLayout gets
            the floating calendar button
          */}
          <Route element={<ProtectedLayout />}>

          <Route path="/calendar" element={<Calendar />} />

<Route
  path="/events/create"
  element={<CreateEvent />}
/>

            
            {/* Home */}
            <Route path="/" element={<Home />} />

            {/* Info */}
            <Route path="/info" element={<Info />} />

            {/* Calendar */}
            <Route
              path="/calendar"
              element={<Calendar />}
            />

            {/* Profile */}
            <Route
              path="/profile"
              element={<Profile />}
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={<Admin />}
            />

            {/* =========================
                LESSONS
            ========================== */}

            <Route
              path="/lessons"
              element={<Lessons />}
            />

            <Route
              path="/lessons/:id"
              element={<LessonViewer />}
            />

            <Route
              path="/lessons/:id/edit"
              element={<EditLesson />}
            />

            <Route
              path="/create-lesson"
              element={<CreateLesson />}
            />

            {/* =========================
                CAMPS / TRIPS
            ========================== */}

            <Route
              path="/camps"
              element={<Camp />}
            />

            <Route
              path="/camps/:id"
              element={<CampDetails />}
            />

            <Route
              path="/create-camp"
              element={<CreateCamp />}
            />

            {/* =========================
                GAMES
            ========================== */}

            <Route
              path="/games"
              element={<Games />}
            />

            <Route
              path="/games/view"
              element={<GameViewer />}
            />

            <Route
              path="/create-game"
              element={<CreateGame />}
            />

            {/* =========================
                ACTIVITIES
            ========================== */}

            <Route
              path="/activities"
              element={<Activities />}
            />

            {/* =========================
                CHANTS
            ========================== */}

            <Route
              path="/chants"
              element={<Chants />}
            />

            <Route
              path="/chants/:id"
              element={<ChantViewer />}
            />

            <Route
              path="/create-chant"
              element={<CreateChant />}
            />

            <Route
              path="/edit-chant/:id"
              element={<EditChant />}
            />

          </Route>
        </Route>

        {/* =========================
            UNKNOWN ROUTES
        ========================== */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </>
  );
};

export default App;