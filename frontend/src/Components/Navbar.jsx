import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { assets } from "../assets/assets.js";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";

const Navbar = () => {
  const navigate = useNavigate();

  const {
    userData,
    backendUrl,
    setUserData,
    setIsLoggedin,
  } = useContext(AppContent);

  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const allowedAdminRoles = ["admin", "pamela", "pascal"];

  const userRoles = Array.isArray(userData?.role)
    ? userData.role
    : userData?.role
      ? [userData.role]
      : [];

  const hasAdminAccess = userRoles.some((role) =>
    allowedAdminRoles.includes(
      String(role).trim().toLowerCase()
    )
  );

  const handleNavigate = (path) => {
    setNavMenuOpen(false);
    setUserMenuOpen(false);
    navigate(path);
  };

  const toggleNavigationMenu = () => {
    setNavMenuOpen((previousState) => !previousState);
    setUserMenuOpen(false);
  };

  const toggleUserMenu = () => {
    setUserMenuOpen((previousState) => !previousState);
    setNavMenuOpen(false);
  };

  const logout = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/auth/logout`
      );

      if (data.success) {
        setIsLoggedin(false);
        setUserData(null);
        setUserMenuOpen(false);
        setNavMenuOpen(false);
        navigate("/");
      } else {
        toast.error(data.message || "Logout failed");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message
      );
    }
  };

  const sendVerifyOtp = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/auth/send-verify-otp`
      );

      if (data.success) {
        toast.success(
          data.message ||
            "Verification OTP sent to your email"
        );

        setUserMenuOpen(false);
        setNavMenuOpen(false);
        navigate("/email-verify");
      } else {
        toast.error(
          data.message ||
            "Failed to send verification OTP"
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message
      );
    }
  };

  return (
    <>
      <nav className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex w-full items-start justify-between bg-transparent px-4 py-4 sm:px-8 sm:py-6 lg:px-12">
        {/* Logo */}
        <div className="pointer-events-auto relative z-[10001]">
          <button
            type="button"
            onClick={toggleNavigationMenu}
            className="relative z-[10002] block cursor-pointer rounded-full transition duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label={
              navMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={navMenuOpen}
          >
            <img
              src={assets.logo}
              alt="The Way logo"
              className="block w-24 sm:w-28 lg:w-32"
            />
          </button>
        </div>

        {/* User menu button */}
        <div className="pointer-events-auto relative z-[10001]">
          {userData ? (
            <>
              <button
                type="button"
                onClick={toggleUserMenu}
                className="relative z-[10002] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:h-11 sm:w-11"
                aria-label={
                  userMenuOpen
                    ? "Close user menu"
                    : "Open user menu"
                }
                aria-expanded={userMenuOpen}
              >
                {userData.name?.[0]?.toUpperCase() || "U"}
              </button>

              {userMenuOpen && (
                <div className="pointer-events-auto absolute right-0 top-full z-[10003] mt-3 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-xl">
                  {!userData.isAccountVerified && (
                    <button
                      type="button"
                      onClick={sendVerifyOtp}
                      className="block w-full cursor-pointer px-4 py-3 text-left transition hover:bg-gray-100"
                    >
                      Verify Email
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleNavigate("/profile")
                    }
                    className="block w-full cursor-pointer px-4 py-3 text-left text-gray-800 transition hover:bg-gray-100"
                  >
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="block w-full cursor-pointer px-4 py-3 text-left text-red-600 transition hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleNavigate("/login")}
              className="relative z-[10002] flex cursor-pointer items-center gap-2 rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:px-5 sm:text-base"
            >
              Login

              <img
                src={assets.arrow_icon}
                width="18"
                height="18"
                alt=""
                className="sm:h-5 sm:w-5"
              />
            </button>
          )}
        </div>
      </nav>

      {/* Main navigation dropdown */}
      {navMenuOpen && (
        <div className="pointer-events-auto fixed left-4 right-4 top-32 z-[10000] sm:left-8 sm:right-auto sm:top-36 sm:max-w-[calc(100vw-4rem)] lg:left-12 lg:top-40">
          <div className="flex max-h-[70vh] flex-wrap gap-3 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("/lessons")}
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Lessons
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("/games")}
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Games
            </button>

            <button
              type="button"
              onClick={() =>
                handleNavigate("/activities")
              }
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Activities
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("/camps")}
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Trips & Camps
            </button>

            <button
              type="button"
              onClick={() => handleNavigate("/chants")}
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Chants
            </button>
                        <button
              type="button"
              onClick={() => handleNavigate("/Info")}
              className="cursor-pointer rounded-full border border-gray-500 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-200 sm:px-5 sm:text-base"
            >
              Info
            </button>

            {hasAdminAccess && (
              <button
                type="button"
                onClick={() => handleNavigate("/admin")}
                className="cursor-pointer rounded-full border border-gray-800 bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 sm:px-5 sm:text-base"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;