import React, {
  useContext,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
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
          Create activities for meetings, lessons, and service.
        </h1>
      </div>
    </div>
  </div>
);

const CreateActivities = () => {
  const navigate = useNavigate();

  const {
    backendUrl,
    userData,
  } = useContext(AppContent);

  const [name, setName] = useState("");
  const [materials, setMaterials] = useState("");
  const [explanation, setExplanation] = useState("");
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Permission
  |--------------------------------------------------------------------------
  */

  const allowedRoles = [
    "pascal",
    "admin",
    "leader",
    "pamela",
  ];

  const canCreate = useMemo(() => {
    const rawRoles = userData?.role;

    const roles = Array.isArray(rawRoles)
      ? rawRoles.map((role) =>
          String(role).toLowerCase().trim()
        )
      : rawRoles
      ? [
          String(rawRoles)
            .toLowerCase()
            .trim(),
        ]
      : [];

    return roles.some((role) =>
      allowedRoles.includes(role)
    );
  }, [userData]);

  /*
  |--------------------------------------------------------------------------
  | Submit
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canCreate) {
      toast.error(
        "You are not allowed to create activities"
      );

      return;
    }

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
      setIsSubmitting(true);

      const { data } = await axios.post(
        `${backendUrl}/api/activities`,
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
            "Activity created successfully"
        );

        navigate("/activities");
      } else {
        toast.error(
          data.message ||
            "Failed to create activity"
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | No Permission
  |--------------------------------------------------------------------------
  */

  if (!canCreate) {
    return (
      <div className="relative min-h-screen bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-center justify-center px-4 pb-10 pt-40 sm:px-8 lg:px-16">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-semibold text-gray-900">
                Create Activity
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                You do not have permission to create activities.
              </p>

              <button
                type="button"
                onClick={() => navigate("/activities")}
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

  return (
    <div className="relative min-h-screen bg-white text-gray-900">
      <Navbar />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-12 pt-40 sm:px-8 lg:px-12 lg:pb-28 lg:pt-36 xl:px-16">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Activity
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Add the materials, explanation, image, and optional video for
                the activity.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Basic Info */}

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
                      placeholder="Example: Balloon Challenge"
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      required
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
                      placeholder="https://..."
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      required
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
                      placeholder="Optional YouTube or video URL"
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

                <p className="mt-1 text-sm text-gray-500">
                  List everything needed for the activity.
                </p>

                <textarea
                  value={materials}
                  onChange={(e) =>
                    setMaterials(e.target.value)
                  }
                  placeholder={`Example:
- Balloons
- Paper
- Pens
- Tape`}
                  rows={7}
                  className="mt-4 min-h-[170px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </section>

              {/* Explanation */}

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
                <label className="text-lg font-semibold text-gray-900">
                  Activity Explanation
                </label>

                <p className="mt-1 text-sm text-gray-500">
                  Explain how the activity is prepared and played.
                </p>

                <textarea
                  value={explanation}
                  onChange={(e) =>
                    setExplanation(e.target.value)
                  }
                  placeholder="Write the activity instructions..."
                  rows={12}
                  className="mt-4 min-h-[280px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-7 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </section>

              {/* Image preview */}

              {image.trim() && (
                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="p-5">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Image Preview
                    </h2>
                  </div>

                  <img
                    src={image}
                    alt="Activity preview"
                    className="h-56 w-full object-cover sm:h-72"
                  />
                </section>
              )}

              {/* Actions */}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isSubmitting
                    ? "Creating..."
                    : "Create Activity"}
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
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

export default CreateActivities;