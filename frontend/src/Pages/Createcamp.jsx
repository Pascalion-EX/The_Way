import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import { assets } from "../assets/assets.js";
import axios from "../utils/axios";
import { toast } from "react-toastify";
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
        <div className="max-w-md">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
            Saint George Church Trips
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            Create and manage trips for the service.
          </h1>
        </div>
      </div>
    </div>
  );


const CreateCamp = () => {
  const navigate = useNavigate();
  const { backendUrl, userData } = useContext(AppContent);

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [tripType, setTripType] = useState("");
  const [selectedYears, setSelectedYears] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowedRoles = ["pascal", "admin", "leader"];
  const yearOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const tripTypeOptions = ["Camp", "Trip", "Outing", "Other"];

  const canCreate = useMemo(() => {
    const rawRoles = userData?.role;

    const normalizedRoles = Array.isArray(rawRoles)
      ? rawRoles.map((role) => String(role).toLowerCase().trim())
      : rawRoles
      ? [String(rawRoles).toLowerCase().trim()]
      : [];

    return normalizedRoles.some((role) => allowedRoles.includes(role));
  }, [userData]);

  const toggleYear = (year) => {
    setSelectedYears((prevYears) => {
      if (prevYears.includes(year)) {
        return prevYears.filter((item) => item !== year);
      }

      return [...prevYears, year].sort((a, b) => a - b);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canCreate) {
      toast.error("You are not allowed to create Trips");
      return;
    }

    if (
      !title ||
      !name ||
      !body ||
      !image ||
      !tripType ||
      selectedYears.length === 0
    ) {
      toast.error("All fields are required");
      return;
    }

    try {
      setIsSubmitting(true);

      const { data } = await axios.post(`${backendUrl}/api/camps`, {
        title,
        name,
        body,
        image,
        TripType: tripType,
        years: selectedYears,
      });

      if (data.success) {
        toast.success(data.message || "Camp created successfully");
        navigate("/camps");
      } else {
        toast.error(data.message || "Failed to create camp");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
          <Navbar/>

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-28 lg:pb-28">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Trip
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Only users with pascal, admin, or leader roles can create
                Trips.
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate("/camps")}
                  className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back to Trips
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Navbar/>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-28 lg:pb-28">
          <div className="w-full max-w-3xl">
            <div className="mb-6 sm:mb-8">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Trip
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                &quot;For he will command his angels concerning you to guard you
                in all your ways.&quot; — Psalm 91:11
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:border-0 lg:p-0 lg:shadow-none"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Trip title"
                  className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />

                <input
                  type="text"
                  placeholder="Trip name / team name"
                  className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <input
                  type="text"
                  placeholder="Image URL"
                  className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:col-span-2"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  required
                />

                <select
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:col-span-2"
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value)}
                  required
                >
                  <option value="">Select trip type</option>
                  {tripTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-300 p-4 sm:p-5">
                <p className="text-sm font-medium text-gray-700">
                  Available years
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Select one or more years for this activity.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {yearOptions.map((year) => {
                    const isSelected = selectedYears.includes(year);

                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => toggleYear(year)}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Year {year}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                placeholder="Trip description"
                rows="12"
                className="mt-5 min-h-[260px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-4 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:min-h-[420px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {isSubmitting ? "Creating..." : "Create Trip"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/camps")}
                  className="h-12 w-full rounded-xl border border-gray-300 px-8 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back to Trips
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CreateCamp;