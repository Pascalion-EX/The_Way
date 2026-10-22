import ContentVideo from "../Components/ContentVideo.jsx";
import React, { useContext, useEffect, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import Navbar from "@/Components/Navbar.jsx";

const ActivitiesViewer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const { backendUrl } = useContext(AppContent);

  const passedActivity = location.state?.activity;

  const [activity, setActivity] = useState(
    passedActivity || null
  );

  const [loading, setLoading] = useState(
    !passedActivity
  );

  /*
  |--------------------------------------------------------------------------
  | Fetch Activity
  |--------------------------------------------------------------------------
  |
  | The activity can arrive through navigation state.
  |
  | If the user refreshes the page, navigation state disappears,
  | so we load the activity again from the backend.
  |
  */

  useEffect(() => {
    const fetchActivity = async () => {
      if (passedActivity) return;

      try {
        setLoading(true);

        const { data } = await axios.get(
          `${backendUrl}/api/activities/${id}`
        );

        if (data.success && data.activity) {
          setActivity(data.activity);
        } else {
          toast.error(
            data.message || "Activity not found"
          );
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            error.message
        );
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [passedActivity, id, backendUrl]);

  /*
  |--------------------------------------------------------------------------
  | Background
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="relative isolate min-h-screen overflow-x-hidden text-gray-900 bg-transparent">

        <Navbar />

        <main className="relative z-10 px-4 pb-12 pt-40 sm:px-8 lg:px-16 lg:pt-40">
          <div className="mx-auto w-full max-w-[900px]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                Loading activity...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Activity Not Found
  |--------------------------------------------------------------------------
  */

  if (!activity) {
    return (
      <div className="relative isolate min-h-screen overflow-x-hidden text-gray-900 bg-transparent">

        <Navbar />

        <main className="relative z-10 px-4 pb-12 pt-40 sm:px-8 lg:px-16 lg:pt-40">
          <div className="mx-auto w-full max-w-[900px]">
            <button
              type="button"
              onClick={() => navigate("/activities")}
              className="mb-6 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              ← Back to activities
            </button>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-semibold text-gray-900">
                Activity not found
              </h1>

              <p className="mt-3 text-sm text-gray-500">
                The requested activity could not be loaded.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }


  return (
    <div className="relative isolate min-h-screen overflow-x-hidden text-gray-900 bg-transparent">

      <Navbar />

      <main className="relative z-10 px-4 pb-12 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-40">
        <div className="mx-auto w-full max-w-[900px]">
          {/* Back */}

          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate("/activities")}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              ← Back to activities
            </button>
          </div>

          {/* Activity Card */}

          <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            {activity.image && (
              <img
                src={activity.image}
                alt={activity.name || "Activity"}
                className="h-56 w-full object-cover sm:h-80 lg:h-[440px]"
              />
            )}

            <div className="px-5 py-7 sm:px-8 sm:py-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500">
                Activity
              </p>

              <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
                {activity.name}
              </h1>

              {/* Materials */}

              <section className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Materials
                </h2>

                <p className="mt-4 whitespace-pre-line break-words text-base leading-8 text-gray-800">
                  {activity.materials}
                </p>
              </section>

              {/* Explanation */}

              <section className="pt-8 sm:pt-10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                  How to do the activity
                </h2>

                <p className="mt-5 whitespace-pre-line break-words text-base leading-8 text-gray-800 sm:text-[18px] sm:leading-10">
                  {activity.explanation}
                </p>
              </section>

              {/* Video */}

              {activity.video && (
                <section className="mt-10">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Activity Video
                  </h2>

                  <ContentVideo video={activity.video} title={`${activity.name || "Activity"} video`} />
                </section>
              )}

              {/* Created By */}

              {activity.createdBy?.name && (
                <div className="mt-10 border-t border-gray-200 pt-5">
                  <p className="text-xs text-gray-500">
                    Added by {activity.createdBy.name}
                  </p>
                </div>
              )}
            </div>
          </article>
        </div>
      </main>
    </div>
  );
};

export default ActivitiesViewer;
