import React, { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";

const ProtectedRoute = ({ requireVerified = true }) => {
  const { isLoggedin, authLoading, userData } = useContext(AppContent);
  const location = useLocation();

  // Prevent redirecting before the authentication cookie is checked
  if (authLoading || (isLoggedin && !userData)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!isLoggedin) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (requireVerified && !userData?.isAccountVerified) {
    return <Navigate to="/email-verify" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
