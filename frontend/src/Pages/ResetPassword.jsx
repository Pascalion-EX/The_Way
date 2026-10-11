import React, { useState, useContext, useEffect } from "react";
import { assets } from "../assets/assets.js";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import { toast } from "react-toastify";
import axios from "../utils/axios";

  const DesktopVisual = () => (
    <div className="relative hidden overflow-hidden lg:block">

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
  const [cooldown, setCooldown] = useState({ email: "", until: 0 });
  const [currentTime, setCurrentTime] = useState(Date.now);
  const resendSeconds = email.trim() === cooldown.email ? Math.max(0, Math.ceil((cooldown.until - currentTime) / 1000)) : 0;

  useEffect(() => {
    if (cooldown.until <= Date.now()) return;
    const timer = setInterval(() => {
      const timestamp = Date.now();
      setCurrentTime(timestamp);
      if (timestamp >= cooldown.until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown.until]);

  const sendOtpHandler = async (e) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (isSendingOtp || (trimmedEmail === cooldown.email && cooldown.until > Date.now())) return;

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
        setCurrentTime(Date.now());
        setCooldown({ email: trimmedEmail, until: data.otpResendAvailableAt || Date.now() + 60_000 });
        toast.success(data.message || "OTP sent to your email");
        setEmail(trimmedEmail);
        setStep(2);
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      if (error.response?.status === 429) {
        setCurrentTime(Date.now());
        setCooldown({ email: trimmedEmail, until: error.response.data.otpResendAvailableAt || Date.now() + error.response.data.retryAfter * 1000 });
      }
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
    <div className="relative min-h-screen overflow-hidden text-gray-900 bg-transparent">
      {/* Logo */}
      <div className="relative z-20 px-4 pt-5 sm:px-8 lg:absolute lg:left-12 lg:top-6 lg:p-0">
        <img
          src={assets.logo}
          alt="logo"
          onClick={() => navigate("/")}
          className="w-24 cursor-pointer sm:w-28 lg:w-32"
        />
      </div>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-transparent">
        <DesktopVisual />

        <main className="min-w-0 flex items-start justify-center px-4 pb-10 pt-8 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
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
                    disabled={isSendingOtp || resendSeconds > 0}
                    className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSendingOtp ? "Requesting OTP..." : resendSeconds > 0 ? `Request another OTP in ${resendSeconds}s` : "Send OTP"}
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
