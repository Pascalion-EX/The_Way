import React, {
  useContext,
  useEffect,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import Navbar from "@/Components/Navbar.jsx";
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
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700">
          Saint George Church Activities
        </p>

        <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
          Update and maintain service activities.
        </h1>
      </div>
    </div>
  </div>
);

const EditActivities = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const { backendUrl } = useContext(AppContent);

  const passedActivity =
    location.state?.activity;

  const [activity, setActivity] =
    useState(passedActivity || null);

  const [loadingPage, setLoadingPage] =
    useState(!passedActivity);

  const [loadingUpdate, setLoadingUpdate] =
    useState(false);

  const [name, setName] = useState(
    passedActivity?.name || ""
  );

  const [materials, setMaterials] = useState(
    passedActivity?.materials || ""
  );

  const [explanation, setExplanation] =
    useState(
      passedActivity?.explanation || ""
    );

  const [image, setImage] = useState(
    passedActivity?.image || ""
  );

  const [video, setVideo] = useState(
    passedActivity?.video || ""
  );

  /*
  |--------------------------------------------------------------------------
  | Fetch Activity
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const fetchActivity = async () => {
      if (passedActivity) return;

      try {
        setLoadingPage(true);

        const { data } = await axios.get(
          `${backendUrl}/api/activities/${id}`
        );

        if (data.success && data.activity) {
          const foundActivity =
            data.activity;

          setActivity(foundActivity);

          setName(
            foundActivity.name || ""
          );

          setMaterials(
            foundActivity.materials || ""
          );

          setExplanation(
            foundActivity.explanation || ""
          );

          setImage(
            foundActivity.image || ""
          );

          setVideo(
            foundActivity.video || ""
          );
        } else {
          toast.error(
            data.message ||
              "Activity not found"
          );
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            error.message
        );
      } finally {
        setLoadingPage(false);
      }
    };

    fetchActivity();
  }, [passedActivity, backendUrl, id]);

  /*
  |--------------------------------------------------------------------------
  | Update
  |--------------------------------------------------------------------------
  */

  const updateActivityHandler = async (e) => {
    e.preventDefault();

    if (
      !name.trim() ||
      !materials.trim() ||
      !explanation.trim()
    ) {
      toast.error(
        "Name, materials,and explanation are required"
      );

      return;
    }

    try {
      setLoadingUpdate(true);

      const { data } = await axios.put(
        `${backendUrl}/api/activities/${id}`,
        {
          name: name.trim(),
          materials: materials.trim(),
          explanation: explanation.trim(),
          image: image.trim(),
          video: video.trim(),
        }
      );

      if (data.success) {
        toast.success(
          data.message ||
            "Activity updated successfully"
        );

        navigate("/activities");
      } else {
        toast.error(
          data.message ||
            "Failed to update activity"
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message
      );
    } finally {
      setLoadingUpdate(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loadingPage) {
    return (
      <div className="relative min-h-screen bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-center justify-center px-4 pt-40 sm:px-8 lg:px-16">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                Loading activity...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Not Found
  |--------------------------------------------------------------------------
  */

  if (!activity) {
    return (
      <div className="relative min-h-screen bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-center justify-center px-4 pt-40 sm:px-8 lg:px-16">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-semibold">
                Activity not found
              </h1>

              <button
                type="button"
                onClick={() =>
                  navigate("/activities")
                }
                className="mt-6 h-12 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to activities
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Main
  |--------------------------------------------------------------------------
  */

  return (
    <div className="relative min-h-screen bg-white text-gray-900">
      <Navbar />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-12 pt-40 sm:px-8 lg:px-12 lg:pb-28 lg:pt-36 xl:px-16">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Edit Activity
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Update the activity information, materials, instructions, and
                media.
              </p>
            </div>

            <form
              onSubmit={updateActivityHandler}
              className="space-y-6"
            >
              {/* Basic Information */}

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 className="text-xl font-semibold text-gray-900">
                  Activity information
                </h2>

                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Activity name
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Image URL
                    </label>

                    <input
                      type="text"
                      value={image}
                      onChange={(e) =>
                        setImage(e.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Video URL
                    </label>

                    <input
                      type="text"
                      value={video}
                      onChange={(e) =>
                        setVideo(e.target.value)
                      }
                      placeholder="Optional video URL"
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </section>

              {/* Materials */}

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
                <label className="text-lg font-semibold text-gray-900">
                  Materials
                </label>

                <textarea
                  value={materials}
                  onChange={(e) =>
                    setMaterials(e.target.value)
                  }
                  rows={7}
                  className="mt-4 min-h-[170px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </section>

              {/* Explanation */}

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
                <label className="text-lg font-semibold text-gray-900">
                  Activity Explanation
                </label>

                <textarea
                  value={explanation}
                  onChange={(e) =>
                    setExplanation(
                      e.target.value
                    )
                  }
                  rows={12}
                  className="mt-4 min-h-[280px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-7 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </section>

              {/* Image Preview */}

              {image.trim() && (
                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="p-5">
                    <h2 className="text-lg font-semibold">
                      Image Preview
                    </h2>
                  </div>

                  <img
                    src={image}
                    alt={name || "Activity preview"}
                    className="h-56 w-full object-cover sm:h-72"
                  />
                </section>
              )}

              {/* Actions */}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loadingUpdate}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {loadingUpdate
                    ? "Updating..."
                    : "Update Activity"}
                </button>

                <button
                  type="button"
                  disabled={loadingUpdate}
                  onClick={() =>
                    navigate("/activities")
                  }
                  className="h-12 w-full rounded-xl border border-gray-300 px-8 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditActivities;