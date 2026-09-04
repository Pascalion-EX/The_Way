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
          Edit and organize lesson content.
        </h1>
      </div>
    </div>
  </div>
);

/*
|--------------------------------------------------------------------------
| Normalize Lesson Partitions
|--------------------------------------------------------------------------
|
| Supports both:
|
| New lessons:
| lesson.partitions
|
| Old lessons:
| lesson.body
|
*/

const getInitialPartitions = (lesson) => {
  if (
    Array.isArray(lesson?.partitions) &&
    lesson.partitions.length > 0
  ) {
    return lesson.partitions.map((partition) => ({
      title: partition.title || "",
      body: partition.body || "",
    }));
  }

  if (lesson?.body) {
    return [
      {
        title: "Lesson Body",
        body: lesson.body,
      },
    ];
  }

  return [
    {
      title: "",
      body: "",
    },
  ];
};

const EditLesson = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const { backendUrl } = useContext(AppContent);

  const passedLesson = location.state?.lesson;

  const [lesson, setLesson] = useState(
    passedLesson || null
  );

  const [loadingPage, setLoadingPage] = useState(
    !passedLesson
  );

  const [loadingUpdate, setLoadingUpdate] =
    useState(false);

  const [title, setTitle] = useState(
    passedLesson?.title || ""
  );

  const [name, setName] = useState(
    passedLesson?.name || ""
  );

  const [image, setImage] = useState(
    passedLesson?.image || ""
  );

  const [activity, setActivity] = useState(
    passedLesson?.activity || ""
  );

  const [video, setVideo] = useState(
    passedLesson?.video || ""
  );

  const [year, setYear] = useState(
    passedLesson?.year || ""
  );

  const [partitions, setPartitions] = useState(
    getInitialPartitions(passedLesson)
  );

  /*
  |--------------------------------------------------------------------------
  | Load Lesson
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const fetchLessonById = async () => {
      if (passedLesson) return;

      try {
        setLoadingPage(true);

        const { data } = await axios.get(
          `${backendUrl}/api/lessons/${id}`
        );

        if (data.success && data.lesson) {
          const foundLesson = data.lesson;

          setLesson(foundLesson);

          setTitle(foundLesson.title || "");
          setName(foundLesson.name || "");
          setImage(foundLesson.image || "");
          setVideo(foundLesson.video || "");
          setActivity(foundLesson.activity || "");
          setYear(foundLesson.year || "");

          setPartitions(
            getInitialPartitions(foundLesson)
          );
        } else {
          toast.error(
            data.message || "Lesson not found"
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

    fetchLessonById();
  }, [passedLesson, id, backendUrl]);

  /*
  |--------------------------------------------------------------------------
  | Partition Controls
  |--------------------------------------------------------------------------
  */

  const addPartition = () => {
    setPartitions((current) => [
      ...current,
      {
        title: "",
        body: "",
      },
    ]);
  };

  const removePartition = (index) => {
    if (partitions.length === 1) {
      toast.error(
        "A lesson must have at least one partition"
      );
      return;
    }

    setPartitions((current) =>
      current.filter(
        (_, partitionIndex) =>
          partitionIndex !== index
      )
    );
  };

  const updatePartition = (
    index,
    field,
    value
  ) => {
    setPartitions((current) =>
      current.map(
        (partition, partitionIndex) =>
          partitionIndex === index
            ? {
                ...partition,
                [field]: value,
              }
            : partition
      )
    );
  };

  const movePartitionUp = (index) => {
    if (index === 0) return;

    setPartitions((current) => {
      const updated = [...current];

      [updated[index - 1], updated[index]] = [
        updated[index],
        updated[index - 1],
      ];

      return updated;
    });
  };

  const movePartitionDown = (index) => {
    if (index === partitions.length - 1) {
      return;
    }

    setPartitions((current) => {
      const updated = [...current];

      [updated[index], updated[index + 1]] = [
        updated[index + 1],
        updated[index],
      ];

      return updated;
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Update Lesson
  |--------------------------------------------------------------------------
  */

  const updateLessonHandler = async (e) => {
    e?.preventDefault();

    if (
      !title.trim() ||
      !name.trim() ||
      !image.trim() ||
      !year
    ) {
      toast.error(
        "Title, name, image, and year are required"
      );
      return;
    }

    const invalidPartition = partitions.some(
      (partition) =>
        !partition.title.trim() ||
        !partition.body.trim()
    );

    if (invalidPartition) {
      toast.error(
        "Every partition must have both a title and body"
      );
      return;
    }

    try {
      setLoadingUpdate(true);

      const { data } = await axios.put(
        `${backendUrl}/api/lessons/${id}`,
        {
          title: title.trim(),
          name: name.trim(),
          image: image.trim(),
          video: video.trim(),
          activity: activity.trim(),
          year: Number(year),

          partitions: partitions.map(
            (partition) => ({
              title: partition.title.trim(),
              body: partition.body.trim(),
            })
          ),
        }
      );

      if (data.success) {
        toast.success(
          data.message ||
            "Lesson updated successfully"
        );

        navigate("/lessons");
      } else {
        toast.error(
          data.message ||
            "Failed to update lesson"
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

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Missing Lesson
  |--------------------------------------------------------------------------
  */

  if (!lesson) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Logo />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-start justify-center px-4 pb-10 pt-8 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
            <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                Lesson not found
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                This lesson could not be loaded.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/lessons")
                }
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

  /*
  |--------------------------------------------------------------------------
  | Main Page
  |--------------------------------------------------------------------------
  */

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      <Logo />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-12 pt-8 sm:px-8 lg:px-12 lg:py-24 xl:px-16">
          <div className="mx-auto w-full max-w-4xl">
            {/* Header */}

            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
                Edit Lesson
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Edit lesson information and organize
                its content into partitions.
              </p>
            </div>

            <form
              onSubmit={updateLessonHandler}
              className="space-y-8"
            >
              {/* Lesson information */}

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Lesson information
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Title
                    </label>

                    <input
                      type="text"
                      value={title}
                      onChange={(e) =>
                        setTitle(e.target.value)
                      }
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
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Year
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={year}
                      onChange={(e) =>
                        setYear(e.target.value)
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
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2">
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
                </div>
              </section>

              {/* Partitions */}

              <section>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      Lesson partitions
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Change, reorder, remove, or add
                      lesson sections.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addPartition}
                    className="h-11 rounded-xl bg-black px-5 text-sm font-medium text-white transition hover:bg-gray-700"
                  >
                    + Add Partition
                  </button>
                </div>

                <div className="space-y-5">
                  {partitions.map(
                    (partition, index) => (
                      <article
                        key={index}
                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Partition {index + 1}
                          </h3>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                movePartitionUp(
                                  index
                                )
                              }
                              disabled={
                                index === 0
                              }
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ↑ Up
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                movePartitionDown(
                                  index
                                )
                              }
                              disabled={
                                index ===
                                partitions.length -
                                  1
                              }
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ↓ Down
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                removePartition(
                                  index
                                )
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-5">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Partition title
                          </label>

                          <input
                            type="text"
                            value={
                              partition.title
                            }
                            onChange={(e) =>
                              updatePartition(
                                index,
                                "title",
                                e.target.value
                              )
                            }
                            className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-gray-700">
                            Partition body
                          </label>

                          <textarea
                            value={
                              partition.body
                            }
                            onChange={(e) =>
                              updatePartition(
                                index,
                                "body",
                                e.target.value
                              )
                            }
                            rows={10}
                            className="min-h-[220px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </article>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={addPartition}
                  className="mt-5 w-full rounded-2xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-600 transition hover:border-gray-500 hover:bg-gray-50 hover:text-gray-900"
                >
                  + Add another partition
                </button>
              </section>

              {/* Activity */}

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <label className="text-lg font-semibold text-gray-900">
                  Lesson Activity
                </label>

                <textarea
                  value={activity}
                  onChange={(e) =>
                    setActivity(e.target.value)
                  }
                  rows={7}
                  placeholder="Lesson activity..."
                  className="mt-4 min-h-[180px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </section>

              {/* Actions */}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loadingUpdate}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {loadingUpdate
                    ? "Updating..."
                    : "Update Lesson"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/lessons")
                  }
                  disabled={loadingUpdate}
                  className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
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

export default EditLesson;