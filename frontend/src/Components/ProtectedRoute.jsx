import React, { useContext, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios.js";
import { pageAccessRoles } from "../../../shared/pageAccess.mjs";

const ProtectedRoute = ({ requireVerified = true }) => {
  const { isLoggedin, authLoading, userData } = useContext(AppContent);
  const location = useLocation();
  const restricted = requireVerified && Boolean(pageAccessRoles(location.pathname));

  // Prevent redirecting before the authentication cookie is checked
  if (authLoading || (isLoggedin && !userData)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
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

  return restricted
    ? <PageAccessGate key={`${location.key}:${location.pathname}`} pathname={location.pathname} />
    : <Outlet />;
};

const PageAccessGate = ({ pathname }) => {
  const { backendUrl } = useContext(AppContent);
  const [access, setAccess] = useState(null);
  const pending = useRef(null);

  useEffect(() => {
    let active = true;
    // Reuse the request during StrictMode's effect replay. A fresh navigation
    // mounts a new gate, including when returning with the browser Back button.
    if (!pending.current) {
      pending.current = axios.post(`${backendUrl}/api/auth/page-access`, { pathname })
        .then(({ data }) => ({ allowed: data.success, message: data.message }))
        .catch((error) => ({ allowed: false, message: error.response?.data?.message || "Unable to check access. Please try again later." }));
    }
    pending.current.then((result) => {
      if (active) setAccess(result);
    });
    return () => { active = false; };
  }, [backendUrl, pathname]);

  if (!access) {
    return <div className="flex min-h-screen items-center justify-center" role="status">Checking access…</div>;
  }

  if (!access.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-4" role="alert">{access.message}</p>
          <a href="/" className="mt-6 inline-block underline">Return home</a>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
