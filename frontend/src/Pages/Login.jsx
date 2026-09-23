import React, { useContext, useState } from "react";
import { assets } from "../assets/assets.js";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import { toast } from "react-toastify";
import axios from "../utils/axios";
import Waves from "../Components/Waves.jsx";
import Navbar from "@/Components/Navbar.jsx";
import { Phone } from "lucide-react";

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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);

const roleOptions = [
  { label: "Parent", value: "parent" },
  { label: "Other", value: "unAssigned" },
];

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
          phone,
          role,
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
                <div className="relative w-full">
                  <input
                    type="text"
                    id="name-input"
                    placeholder=" "
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="
                      peer
                      h-12
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      bg-transparent
                      px-4
                      pb-1
                      pt-4
                      text-sm
                      outline-none
                      transition
                      focus:border-indigo-500
                      focus:ring-2
                      focus:ring-indigo-500
                    "
                  />

                  <label
                    htmlFor="name-input"
                    className="
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      bg-white
                      px-1
                      text-sm
                      text-gray-500
                      transition-all
                      duration-200

                      peer-focus:left-3
                      peer-focus:top-0
                      peer-focus:text-xs
                      peer-focus:text-indigo-500

                      peer-not-placeholder-shown:left-3
                      peer-not-placeholder-shown:top-0
                      peer-not-placeholder-shown:text-xs
                    "
                  >
                    Full name
                  </label>
                </div>
              )}

              <div className="relative w-full">
                <input
                  type="email"
                  id="email-input"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="
                    peer
                    h-12
                    w-full
                    rounded-xl
                    border
                    border-gray-300
                    bg-transparent
                    px-4
                    pb-1
                    pt-4
                    text-sm
                    outline-none
                    transition
                    focus:border-indigo-500
                    focus:ring-2
                    focus:ring-indigo-500
                  "
                />

                <label
                  htmlFor="email-input"
                  className="
                    absolute
                    left-4
                    top-1/2
                    -translate-y-1/2
                    bg-white
                    px-1
                    text-sm
                    text-gray-500
                    transition-all
                    duration-200

                    peer-focus:left-3
                    peer-focus:top-0
                    peer-focus:text-xs
                    peer-focus:text-indigo-500

                    peer-not-placeholder-shown:left-3
                    peer-not-placeholder-shown:top-0
                    peer-not-placeholder-shown:text-xs
                  "
                >
                  Email
                </label>
              </div>
              {state === "Sign Up" && (
                <div className="relative w-full">
                  {/* Phone Icon */}
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg
                      className="h-4 w-4"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M18.427 14.768 17.2 13.542a1.733 1.733 0 0 0-2.45 0l-.613.613a1.732 1.732 0 0 1-2.45 0l-1.838-1.84a1.735 1.735 0 0 1 0-2.452l.612-.613a1.735 1.735 0 0 0 0-2.452L9.237 5.572a1.6 1.6 0 0 0-2.45 0c-3.223 3.2-1.702 6.896 1.519 10.117 3.22 3.221 6.914 4.745 10.12 1.535a1.601 1.601 0 0 0 0-2.456Z"
                      />
                    </svg>
                  </span>

                  {/* Phone Input */}
                  <input
                    type="tel"
                    id="phone-input"
                    placeholder=" "
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="
                      peer
                      h-12
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      bg-transparent
                      pb-1
                      pl-11
                      pr-4
                      pt-4
                      text-sm
                      outline-none
                      transition
                      focus:border-indigo-500
                      focus:ring-2
                      focus:ring-indigo-500
                    "
                  />

                  {/* Floating Label */}
                  <label
                    htmlFor="phone-input"
                    className="
                      absolute
                      left-11
                      top-1/2
                      -translate-y-1/2
                      bg-white
                      px-1
                      text-sm
                      text-gray-500
                      transition-all
                      duration-200

                      peer-focus:left-3
                      peer-focus:top-0
                      peer-focus:text-xs
                      peer-focus:text-indigo-500

                      peer-not-placeholder-shown:left-3
                      peer-not-placeholder-shown:top-0
                      peer-not-placeholder-shown:text-xs
                    "
                  >
                    Phone Number
                  </label>
                </div>
              )}
                <div className="relative w-full">
                  <input
                    type="password"
                    id="password-input"
                    placeholder=" "
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="
                      peer
                      h-12
                      w-full
                      rounded-xl
                      border
                      border-gray-300
                      bg-transparent
                      px-4
                      pb-1
                      pt-4
                      text-sm
                      outline-none
                      transition
                      focus:border-indigo-500
                      focus:ring-2
                      focus:ring-indigo-500
                    "
                  />

                  <label
                    htmlFor="password-input"
                    className="
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      bg-white
                      px-1
                      text-sm
                      text-gray-500
                      transition-all
                      duration-200

                      peer-focus:left-3
                      peer-focus:top-0
                      peer-focus:text-xs
                      peer-focus:text-indigo-500

                      peer-not-placeholder-shown:left-3
                      peer-not-placeholder-shown:top-0
                      peer-not-placeholder-shown:text-xs
                    "
                  >
                    Password
                  </label>
                </div>
{state === "Sign Up" && (
  <div className="relative w-full">
    {/* Dropdown button */}
    <button
      type="button"
      onClick={() => setRoleOpen(!roleOpen)}
      className="
        flex
        h-12
        w-full
        items-center
        justify-between
        rounded-xl
        border
        border-gray-300
        bg-white
        px-4
        text-sm
        outline-none
        transition
        focus:border-indigo-500
        focus:ring-2
        focus:ring-indigo-500
      "
    >
      <span className={role ? "text-gray-900" : "text-gray-500"}>
        {role
          ? roleOptions.find((option) => option.value === role)?.label
          : "Select Role"}
      </span>

      <svg
        className={`h-4 w-4 transition-transform ${
          roleOpen ? "rotate-180" : ""
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="m6 9 6 6 6-6"
        />
      </svg>
    </button>

    {/* Dropdown list */}
    {roleOpen && (
      <div
        className="
          absolute
          left-0
          top-[54px]
          z-50
          w-full
          overflow-hidden
          rounded-xl
          border
          border-indigo-500
          bg-white
          shadow-lg
        "
      >
        {roleOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setRole(option.value);
              setRoleOpen(false);
            }}
            className="
              w-full
              px-4
              py-3
              text-left
              text-sm
              text-gray-700
              transition
              hover:bg-indigo-50
              hover:text-indigo-600
            "
          >
            {option.label}
          </button>
        ))}
      </div>
    )}
  </div>
)}
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