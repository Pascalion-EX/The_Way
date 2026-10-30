import React, { lazy, Suspense } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

const Login = lazy(() => import("./Pages/Login"));
const Home = lazy(() => import("./Pages/Home"));
const Calendar = lazy(() => import("./Pages/Calendar.jsx"));
const Lessons = lazy(() => import("./Pages/Lessons"));
const Curriculum = lazy(() => import("./Pages/Curriculum.jsx"));
const EmailVerify = lazy(() => import("./Pages/EmailVerify"));
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));
const CreateLesson = lazy(() => import("./Pages/CreateLesson"));
const LessonViewer = lazy(() => import("./Pages/LessonViewer"));
const EditLesson = lazy(() => import("./Pages/EditLesson.jsx"));
const Camp = lazy(() => import("./Pages/Camps.jsx"));
const CreateCamp = lazy(() => import("./Pages/Createcamp.jsx"));
const Games = lazy(() => import("./Pages/Games.jsx"));
const Chants = lazy(() => import("./Pages/Chants.jsx"));
const ChantViewer = lazy(() => import("./Pages/ChantViewer.jsx"));
const CreateChant = lazy(() => import("./Pages/CreateChant.jsx"));
const EditChant = lazy(() => import("./Pages/EditChant.jsx"));
const CampDetails = lazy(() => import("./Pages/CampDetails.jsx"));
const Profile = lazy(() => import("./Pages/Profile.jsx"));
const Admin = lazy(() => import("./Pages/Admin.jsx"));
const Activities = lazy(() => import("./Pages/Activities.jsx"));
const YearOneToThreeActivities = lazy(() => import("./Pages/YearOneToThreeActivities.jsx"));
const CreateGame = lazy(() => import("./Pages/Creategame.jsx"));
const Info = lazy(() => import("./Pages/Info.jsx"));
const GameViewer = lazy(() => import("./Pages/GamesViewer.jsx"));
const CreateEvent = lazy(() => import("./Pages/CreateEvent"));
const EditEvent = lazy(() => import("./Pages/EditEvent.jsx"));
const ActivitiesViewer = lazy(() => import("./Pages/ActivitiesViewer.jsx"));
const CreateActivities = lazy(() => import("./Pages/CreateActivities.jsx"));
const Attendance = lazy(() => import("./Pages/Attendance.jsx"));
const EditActivities = lazy(() => import("./Pages/EditActivities.jsx"));
const ChildProfiles = lazy(() => import("./Pages/ChildProfile"));
const EditGame = lazy(() => import("./Pages/EditGame"));
import ProtectedRoute from "./Components/ProtectedRoute.jsx";
import CalendarFloatingButton from "./Components/CalendarFloatingButton.jsx";
const VideoRequests = lazy(() => import("./Pages/VideoRequests"));
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "./Components/footer";
import Waves from "./Components/Waves.jsx";

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
    <div className="relative isolate flex min-h-screen flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900 [&:has([data-projector-mode])>footer]:hidden">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <Waves
          lineColor="#e4b54f7e"
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
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        className="!z-[99999]"
      />

      <div className="relative z-10 flex-1">
      <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center" role="status">Loading page…</div>}>
      <Routes>
        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute requireVerified={false} />}>
          <Route path="/email-verify" element={<EmailVerify />} />
        </Route>

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
<Route
  path="/events/:id/edit"
  element={<EditEvent />}
/>
            
            {/* Home */}
            <Route path="/" element={<Home />} />
            <Route path="/curriculum" element={<Curriculum />} />

            {/* Info */}
            <Route path="/info" element={<Info />} />


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
            <Route
              path="/video-requests"
              element={<VideoRequests />}
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



        <Route path="/childrenProfile" element={<ChildProfiles />} />

        
        <Route path="/attendance" element={<Attendance />} />
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
              path="/games/:id"
              element={<GameViewer />}
            />

            <Route
              path="/create-game"
              element={<CreateGame />}
            />
            <Route
              path="/games/:id/edit"
              element={<EditGame />}
            />

            {/* =========================
                ACTIVITIES
            ========================== */}

            <Route
              path="/activities"
              element={<Activities />}
            />
            <Route path="/activities/year-1-3" element={<YearOneToThreeActivities />} />
            <Route
              path="/activities/:id"
              element={<ActivitiesViewer />}
            />

            <Route
              path="/create-activity"
              element={<CreateActivities />}
            />

            <Route
              path="/activities/:id/edit"
              element={<EditActivities />}
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
      </Suspense>
      </div>
      <Footer />
    </div>
  );
};

export default App;
