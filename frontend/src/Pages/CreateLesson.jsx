import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
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
          Saint George Church Lessons
        </p>

        <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
          Create structured lessons one section at a time.
        </h1>
      </div>
    </div>
  </div>
);

const CreateLesson = () => {
  const navigate = useNavigate();
  const { backendUrl, userData } = useContext(AppContent);

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [activity, setActivity] = useState("");

  const [partitions, setPartitions] = useState([
    {
      title: "",
      body: "",
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowedRoles = ["pascal", "admin", "leader", "pamela"];

  const canCreate = useMemo(() => {
    const rawRoles = userData?.role;

    const normalizedRoles = Array.isArray(rawRoles)
      ? rawRoles.map((role) => String(role).toLowerCase().trim())
      : rawRoles
      ? [String(rawRoles).toLowerCase().trim()]
      : [];

    return normalizedRoles.some((role) =>
      allowedRoles.includes(role)
    );
  }, [userData]);

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
      toast.error("A lesson must have at least one partition");
      return;
    }

    setPartitions((current) =>
      current.filter((_, partitionIndex) => partitionIndex !== index)
    );
  };

  const updatePartition = (index, field, value) => {
    setPartitions((current) =>
      current.map((partition, partitionIndex) =>
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
    if (index === partitions.length - 1) return;

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
  | Submit
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canCreate) {
      toast.error("You are not allowed to create lessons");
      return;
    }

    if (!title.trim() || !name.trim() || !year || !image.trim()) {
      toast.error("Title, name, image, and year are required");
      return;
    }

    const invalidPartition = partitions.some(
      (partition) =>
        !partition.title.trim() || !partition.body.trim()
    );

    if (invalidPartition) {
      toast.error(
        "Every partition must have both a title and body"
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const { data } = await axios.post(
        `${backendUrl}/api/lessons`,
        {
          title: title.trim(),
          name: name.trim(),
          year: Number(year),
          image: image.trim(),

          video: video.trim(),
          activity: activity.trim(),

          partitions: partitions.map((partition) => ({
            title: partition.title.trim(),
            body: partition.body.trim(),
          })),
        }
      );

      if (data.success) {
        toast.success(
          data.message || "Lesson created successfully"
        );

        navigate("/lessons");
      } else {
        toast.error(
          data.message || "Failed to create lesson"
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="flex items-start justify-center px-4 pb-10 pt-40 sm:px-8 lg:min-h-screen lg:items-center lg:px-16 lg:py-24">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create lesson
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                You do not have permission to create lessons.
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate("/lessons")}
                  className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back to lessons
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
      <Navbar />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-12 pt-40 sm:px-8 lg:px-12 lg:pb-28 lg:pt-36 xl:px-16">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create lesson
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Build the lesson using modular partitions with individual
                titles and body text.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-8"
            >
              {/* Main lesson information */}

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Lesson information
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Lesson title
                    </label>

                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Lesson title"
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Lesson name
                    </label>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Lesson name"
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      required
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
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="Year"
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
                      onChange={(e) => setVideo(e.target.value)}
                      placeholder="Optional video link"
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
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="Image URL"
                      className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      required
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
                      Each partition contains its own title and content.
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
                  {partitions.map((partition, index) => (
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
                              movePartitionUp(index)
                            }
                            disabled={index === 0}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ↑ Up
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              movePartitionDown(index)
                            }
                            disabled={
                              index === partitions.length - 1
                            }
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ↓ Down
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removePartition(index)
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
                          value={partition.title}
                          onChange={(e) =>
                            updatePartition(
                              index,
                              "title",
                              e.target.value
                            )
                          }
                          placeholder="Example: Introduction"
                          className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Partition body
                        </label>

                        <textarea
                          value={partition.body}
                          onChange={(e) =>
                            updatePartition(
                              index,
                              "body",
                              e.target.value
                            )
                          }
                          placeholder="Write this section of the lesson..."
                          rows={10}
                          className="min-h-[220px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </article>
                  ))}
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
                <label className="block text-lg font-semibold text-gray-900">
                  Lesson Activity
                </label>

                <p className="mt-1 text-sm text-gray-500">
                  Optional activity or practical application for the lesson.
                </p>

                <textarea
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  placeholder="Lesson activity..."
                  rows={7}
                  className="mt-4 min-h-[180px] w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </section>

              {/* Actions */}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {isSubmitting
                    ? "Creating..."
                    : "Create Lesson"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/lessons")}
                  disabled={isSubmitting}
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

export default CreateLesson;