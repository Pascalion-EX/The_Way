import React, { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";

const ProtectedRoute = () => {
  const { isLoggedin, authLoading } = useContext(AppContent);
  const location = useLocation();

  // Prevent redirecting before the authentication cookie is checked
  if (authLoading) {
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

  return <Outlet />;
};

export default ProtectedRoute;