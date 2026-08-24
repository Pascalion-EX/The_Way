import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./Pages/Login";
import Home from "./Pages/Home";
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
import ProtectedRoute from "./Components/ProtectedRoute.jsx";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  return (
    <div>
      <ToastContainer />

      <Routes>
        {/* Public authentication routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/email-verify" element={<EmailVerify />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* All routes inside this section require login */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />

          <Route path="/info" element={<Info />} />

          <Route path="/profile" element={<Profile />} />
          <Route path="/games/view" element={<GameViewer />} />

          <Route path="/admin" element={<Admin />} />

          <Route path="/lessons" element={<Lessons />} />
          <Route path="/lessons/:id" element={<LessonViewer />} />
          <Route path="/lessons/:id/edit" element={<EditLesson />} />
          <Route path="/create-lesson" element={<CreateLesson />} />

          <Route path="/camps" element={<Camp />} />
          <Route path="/camps/:id" element={<CampDetails />} />
          <Route path="/create-camp" element={<CreateCamp />} />

          <Route path="/games" element={<Games />} />
          <Route path="/create-game" element={<CreateGame />} />

          <Route path="/activities" element={<Activities />} />

          <Route path="/chants" element={<Chants />} />
          <Route path="/chants/:id" element={<ChantViewer />} />
          <Route path="/create-chant" element={<CreateChant />} />
          <Route path="/edit-chant/:id" element={<EditChant />} />
        </Route>

        {/* Unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;