import React, { useState, useContext } from "react";
import { assets } from "../assets/assets.js";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import { toast } from "react-toastify";
import axios from "../utils/axios";
import Waves from "../Components/Waves.jsx";

  const DesktopVisual = () => (
    <div className="relative hidden overflow-hidden lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

      <div className="absolute inset-0">
        <Waves
          lineColor="#e4b54f"
          backgroundColor="rgba(255, 255, 255, 0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white" />

      <div className="relative z-10 flex h-full items-center justify-center px-12">
        <div className="max-w-md">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
            Saint George Church
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            Reset your password securely.
          </h1>

          <p className="mt-5 text-sm leading-6 text-gray-600">
            Use your email and OTP to recover access to your account.
          </p>
        </div>
      </div>
    </div>
  );

const ResetPassword = () => {
  const navigate = useNavigate();
  const { backendUrl } = useContext(AppContent);

  const [step, setStep] = useState(1);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const sendOtpHandler = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }

    try {
      setIsSendingOtp(true);

      const { data } = await axios.post(
        `${backendUrl}/api/auth/send-reset-otp`,
        {
          email: trimmedEmail,
        }
      );

      if (data.success) {
        toast.success(data.message || "OTP sent to your email");
        setEmail(trimmedEmail);
        setStep(2);
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const resetPasswordHandler = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();

    if (
      !trimmedEmail ||
      !trimmedOtp ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      toast.error("All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setIsResettingPassword(true);

      const { data } = await axios.post(`${backendUrl}/api/auth/reset-password`, {
        email: trimmedEmail,
        otp: trimmedOtp,
        newPassword,
      });

      if (data.success) {
        toast.success(data.message || "Password has been reset successfully");
        navigate("/login");
      } else {
        toast.error(data.message || "Failed to reset password");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };



  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      {/* Logo */}
      <div className="relative z-20 px-4 pt-5 sm:px-8 lg:absolute lg:left-12 lg:top-6 lg:p-0">
        <img
          src={assets.logo}
          alt="logo"
          onClick={() => navigate("/")}
          className="w-24 cursor-pointer sm:w-28 lg:w-32"
        />
      </div>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="flex items-start justify-center px-4 pb-10 pt-8 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Reset password
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                {step === 1
                  ? "Enter your email and we will send you a reset OTP."
                  : "Enter the OTP sent to your email and choose a new password."}
              </p>

              {step === 1 ? (
                <form onSubmit={sendOtpHandler} className="mt-8 space-y-4">
                  <input
                    type="email"
                    placeholder="Email"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSendingOtp ? "Sending OTP..." : "Send OTP"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={resetPasswordHandler}
                  className="mt-8 space-y-4"
                >
                  <input
                    type="email"
                    placeholder="Email"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="OTP"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />

                  <input
                    type="password"
                    placeholder="New password"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />

                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isResettingPassword ? "Resetting..." : "Reset password"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-12 w-full rounded-xl border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Back
                  </button>
                </form>
              )}

              <div className="mt-6 text-center text-sm leading-6 text-gray-500">
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ResetPassword;