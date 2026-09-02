import React, { useContext, useState } from "react";
import { assets } from "../assets/assets.js";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import { toast } from "react-toastify";
import axios from "../utils/axios";
import Waves from "../Components/Waves.jsx";
import Navbar from "@/Components/Navbar.jsx";

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
      <div className="max-w-xl">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
          Saint George Church
        </p>

        <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
          Welcome to the Way&apos;s website.
        </h1>

        <p className="mt-5 text-sm leading-6 text-gray-600">
          Log in to continue using the service tools.
        </p>
      </div>
    </div>
  </div>
);

const Login = () => {
  const navigate = useNavigate();

  const { backendUrl, setIsLoggedin, getUserData } = useContext(AppContent);

  const [state, setState] = useState("Login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    if (loading) return;

    try {
      setLoading(true);
      axios.defaults.withCredentials = true;

      if (state === "Sign Up") {
        const { data } = await axios.post(`${backendUrl}/api/auth/register`, {
          name,
          email,
          password,
        });

        if (data.success) {
          setIsLoggedin(true);
          await getUserData();
          toast.success(data.message || "Account created successfully");
          navigate("/");
        } else {
          toast.error(data.message || "Registration failed");
        }
      } else {
        const { data } = await axios.post(`${backendUrl}/api/auth/login`, {
          email,
          password,
        });

        if (data.success) {
          setIsLoggedin(true);
          await getUserData();
          toast.success(data.message || "Logged in successfully");
          navigate("/");
        } else {
          toast.error(data.message || "Login failed");
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };



  return (
  <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-white text-gray-900">
    <Navbar />

    <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <DesktopVisual />

      {/* Form */}
      <main
        className="
          flex
          items-start
          justify-center
          px-4
          pb-10
          pt-32
          sm:px-8
          sm:pt-36
          lg:min-h-0
          lg:items-center
          lg:px-16
          lg:py-24
        "
      >
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">

            <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              {state === "Login"
                ? "Welcome back"
                : "Create account"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
              {state === "Login"
                ? "Please log in to continue."
                : "Start your journey with Christ."}
            </p>

            <form
              onSubmit={onSubmitHandler}
              className="mt-8 space-y-4"
            >
              {state === "Sign Up" && (
                <input
                  type="text"
                  placeholder="Full name"
                  className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email"
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password"
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {state === "Login" && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/reset-password")
                    }
                    className="text-sm font-medium text-gray-500 transition hover:text-indigo-600"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? state === "Login"
                    ? "Logging in..."
                    : "Creating..."
                  : state === "Login"
                    ? "Continue"
                    : "Create account"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm leading-6 text-gray-500">
              {state === "Login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setState("Sign Up")
                    }
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setState("Login")
                    }
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>

    <footer className="border-t border-gray-200 bg-white/80 px-4 py-4 text-center text-sm text-gray-500 backdrop-blur-md">
      © {new Date().getFullYear()} The Way Service. All rights reserved.
    </footer>
  </div>
);
};

export default Login;