import React, { useContext, useState } from "react";
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext";
import axios from "../utils/axios";
import { toast } from "react-toastify";

const EmailVerify = () => {
  const navigate = useNavigate();
  const { backendUrl } = useContext(AppContent);

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    try {
      setLoading(true);
      axios.defaults.withCredentials = true;

      const { data } = await axios.post(
        `${backendUrl}/api/auth/verify-account`,
        { otp: otp.trim() }
      );

      if (data.success) {
        toast.success("Email verified successfully");
        navigate("/");
      } else {
        toast.error(data.message || "Failed to verify email");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResending(true);
      axios.defaults.withCredentials = true;

      const { data } = await axios.post(
        `${backendUrl}/api/auth/send-verify-otp`
      );

      if (data.success) {
        toast.success(data.message || "OTP sent again");
      } else {
        toast.error(data.message || "Failed to resend OTP");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className='relative min-h-screen overflow-hidden bg-[url("/bg.jpg")] bg-cover bg-center text-gray-800'>
      {/* Background overlay */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]" />

      {/* Logo */}
      <header className="relative z-20 flex w-full items-center px-4 py-5 sm:px-8 lg:px-24">
        <img
          onClick={() => navigate("/")}
          src={assets.logo}
          alt="Logo"
          className="w-24 cursor-pointer sm:w-28 lg:w-32"
        />
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-start justify-center px-4 pb-10 pt-6 sm:items-center sm:px-6 sm:pt-0">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/70 bg-white/70 px-5 py-8 text-center shadow-lg backdrop-blur-md sm:px-8 sm:py-9">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Verify Your Email
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
              Enter the OTP sent to your email.
            </p>

            <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="h-12 w-full rounded-full border border-gray-300 bg-white px-5 text-center text-lg tracking-[0.35em] text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-300"
              />

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-full border border-gray-600 bg-white px-8 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending}
              className="mt-5 text-sm font-medium text-gray-600 transition hover:text-gray-900 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resending ? "Sending OTP..." : "Didn’t receive OTP? Resend"}
            </button>
          </div>

          <p className="mx-auto mt-6 max-w-sm px-4 text-center text-sm leading-6 text-gray-700">
            Secure your account by verifying your email.
          </p>
        </div>
      </main>
    </div>
  );
};

export default EmailVerify;