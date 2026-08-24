import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { assets } from "../assets/assets.js";
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
            Saint George Church Lessons
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            Edit and manage lesson content.
          </h1>
        </div>
      </div>
    </div>
  );

const EditLesson = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { backendUrl } = useContext(AppContent);

  const passedLesson = location.state?.lesson;

  const [lesson, setLesson] = useState(passedLesson || null);
  const [loadingPage, setLoadingPage] = useState(!passedLesson);
  const [loadingUpdate, setLoadingUpdate] = useState(false);

  const [title, setTitle] = useState(passedLesson?.title || "");
  const [name, setName] = useState(passedLesson?.name || "");
  const [body, setBody] = useState(passedLesson?.body || "");
  const [image, setImage] = useState(passedLesson?.image || "");
  const [activity, setActivity] = useState(passedLesson?.activity || "");
  const [video, setVideo] = useState(passedLesson?.video || "");

  const [year, setYear] = useState(passedLesson?.year || "");

  useEffect(() => {
    const fetchLessonById = async () => {
      if (passedLesson) return;

      try {
        setLoadingPage(true);

        const { data } = await axios.get(`${backendUrl}/api/lessons/${id}`);

        if (data.success && data.lesson) {
          const foundLesson = data.lesson;

          setLesson(foundLesson);
          setTitle(foundLesson.title || "");
          setName(foundLesson.name || "");
          setVideo(foundLesson.video || "");
          setBody(foundLesson.body || "");
          setImage(foundLesson.image || "");
          setYear(foundLesson.year || "");
        } else {
          toast.error(data.message || "Lesson not found");
        }
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchLessonById();
  }, [passedLesson, id, backendUrl]);

  const updateLessonHandler = async (e) => {
    e.preventDefault();

    if (!title || !name || !body || !image || !year) {
      toast.error("All fields are required");
      return;
    }

    try {
      setLoadingUpdate(true);

      const { data } = await axios.put(`${backendUrl}/api/lessons/${id}`, {
        title,
        name,
        body,
        image,
        video,
        activity,
        year: Number(year),
      });

      if (data.success) {
        toast.success(data.message || "Lesson updated successfully");
        navigate("/lessons");
      } else {
        toast.error(data.message || "Failed to update lesson");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoadingUpdate(false);
    }
  };


  const Logo = () => (
    <div className="relative z-20 px-4 pt-5 sm:px-8 lg:absolute lg:left-12 lg:top-6 lg:p-0">
      <img
        src={assets.logo}
        alt="logo"
        onClick={() => navigate("/")}
        className="w-24 cursor-pointer sm:w-28 lg:w-32"
      />
    </div>
  );

  if (loadingPage) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Logo />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-start justify-center px-4 pb-10 pt-8 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <p className="text-sm leading-6 text-gray-600 sm:text-base">
                Loading lesson...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Logo />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-start justify-center px-4 pb-10 pt-8 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
            <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <h1 className="break-words text-2xl font-semibold text-gray-900 sm:text-3xl">
                Lesson not found
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                This lesson could not be loaded.
              </p>

              <button
                type="button"
                onClick={() => navigate("/lessons")}
                className="mt-6 h-12 w-full rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white transition hover:bg-indigo-500 sm:w-auto"
              >
                Back to lessons
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      <Logo />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-10 pt-8 sm:px-8 lg:px-16 lg:py-24">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={updateLessonHandler}
                disabled={loadingUpdate}
                className="h-12 w-full rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loadingUpdate ? "Updating..." : "Update Lesson"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/lessons")}
                className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              >
                Back
              </button>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8">
              <h1 className="break-words text-3xl font-semibold text-gray-900 sm:text-4xl">
                Edit Lesson
              </h1>

              <form onSubmit={updateLessonHandler} className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Title
                  </label>

                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Name
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Year
                  </label>

                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
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
                    onChange={(e) => setImage(e.target.value)}
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
                    onChange={(e) => setVideo(e.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Body
                  </label>

                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="min-h-[260px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:min-h-[420px]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Activity
                  </label>

                  <textarea
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    rows={12}
                    className="min-h-[260px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:min-h-[420px]"
                  />
                </div>

                <button type="submit" className="hidden">
                  Update
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditLesson;