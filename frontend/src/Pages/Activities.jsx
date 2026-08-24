import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import Waves from "../Components/Waves.jsx";
import Navbar from "@/Components/Navbar.jsx";

const Activities = () => {
  const navigate = useNavigate();
  const { backendUrl, userData, isLoggedin } = useContext(AppContent);

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const allowedRoles = ["pascal", "admin", "leader", "Pamela"];

  const canManageActivities = useMemo(() => {
    const roles = Array.isArray(userData?.role)
      ? userData.role
      : userData?.role
      ? [userData.role]
      : [];

    return roles.some((role) => allowedRoles.includes(role));
  }, [userData]);

  const fetchActivities = async (currentSearch = "") => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (currentSearch.trim()) {
        params.append("search", currentSearch.trim());
      }

      const url = `${backendUrl}/api/activities${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const { data } = await axios.get(url);

      if (data.success) {
        setActivities(data.activities);
      } else {
        toast.error(data.message || "Failed to load activities");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchActivities(search);
  };

  const clearFilters = () => {
    setSearch("");
    fetchActivities("");
  };

  const deleteActivityHandler = async (activityId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this activity?"
    );

    if (!confirmDelete) return;

    try {
      const { data } = await axios.delete(
        `${backendUrl}/api/activities/${activityId}`
      );

      if (data.success) {
        toast.success(data.message || "Activity deleted successfully");
        fetchActivities(search);
      } else {
        toast.error(data.message || "Failed to delete activity");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const handleViewActivity = (activity) => {
    navigate(`/activities/${activity._id}`, {
      state: { activity },
    });
  };

  const handleEditActivity = (activity) => {
    navigate(`/activities/${activity._id}/edit`, {
      state: { activity },
    });
  };

  const getPreviewText = (text = "", maxLength = 80) => {
    if (!text) return "No explanation available.";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Desktop Visual Section */}
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
              Saint George Church Activities
            </p>

            <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
              Let everything you do be done in love.
            </h1>
          </div>
        </div>
      </div>

      <Navbar />

      {/* Main Content */}
      <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-28 lg:pb-28">
        <div className="mx-auto w-full max-w-4xl">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Activities
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500 sm:text-base">
              Search activities and manage them based on your role.
            </p>
          </div>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            <input
              type="text"
              placeholder="Search by name, materials, or explanation"
              className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:col-span-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="h-12 w-full rounded-xl border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Clear
            </button>

            {canManageActivities && (
              <button
                type="button"
                onClick={() => navigate("/create-activity")}
                className="h-12 w-full rounded-xl bg-black text-sm font-medium text-white shadow-md transition hover:bg-gray-700 md:col-span-2 xl:col-span-1"
              >
                Create Activity
              </button>
            )}
          </form>

          {/* Permission Notice */}
          {!canManageActivities && isLoggedin && (
            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600 sm:p-5">
              You can view activities, but only users with pascal, admin,
              leader, or Pamela roles can create, edit, or delete activities.
            </div>
          )}

          {/* Activities */}
          <section className="mt-8 sm:mt-10">
            {loading ? (
              <p className="text-sm text-gray-500">Loading activities...</p>
            ) : activities.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 sm:p-6">
                No activities found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {activities.map((activity) => (
                  <article
                    key={activity._id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                  >
                    {/* Image */}
                    <img
                      src={activity.image}
                      alt={activity.name}
                      className="h-40 w-full object-cover sm:h-48 lg:h-56"
                    />

                    {/* Card Body */}
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words text-xl font-semibold text-gray-900 sm:text-2xl">
                            {activity.name}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            {activity.materials
                              ? `Materials: ${activity.materials}`
                              : "No materials listed"}
                          </p>
                        </div>

                        {canManageActivities && (
                          <button
                            type="button"
                            onClick={() =>
                              deleteActivityHandler(activity._id)
                            }
                            className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:w-auto"
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
                        {getPreviewText(activity.explanation)}
                      </p>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => handleViewActivity(activity)}
                          className="w-full rounded-xl border-2 border-black px-6 py-2 text-base font-semibold text-black transition hover:bg-gray-100 sm:w-auto"
                        >
                          View
                        </button>

                        {canManageActivities && (
                          <button
                            type="button"
                            onClick={() => handleEditActivity(activity)}
                            className="w-full rounded-xl bg-indigo-600 px-6 py-2 text-base font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Activities;