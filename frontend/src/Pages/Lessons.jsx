import ContentImage from "../Components/ContentImage.jsx";
import Pagination from "../Components/Pagination.jsx";
import usePaginatedList from "../hooks/usePaginatedList.js";
import React, {
  useContext,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import Navbar from "@/Components/Navbar.jsx";

const Lessons = () => {
  const navigate = useNavigate();

  const {
    backendUrl,
    userData,
    isLoggedin,
  } = useContext(AppContent);

  const [search, setSearch] =
    useState("");

  const [yearFilter, setYearFilter] =
    useState("0");

  /*
  |--------------------------------------------------------------------------
  | Permissions
  |--------------------------------------------------------------------------
  */

  const canManageLessons =
    useMemo(() => {
      const allowedRoles = [
        "pascal",
        "admin",
        "servant",
        "pamela",
      ];

      const roles = Array.isArray(
        userData?.role
      )
        ? userData.role.map((role) =>
            String(role)
              .toLowerCase()
              .trim()
          )
        : userData?.role
        ? [
            String(userData.role)
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
  | Fetch Lessons
  |--------------------------------------------------------------------------
  */

  const { items: lessons, loading, pagination, setPage, setFilters, refresh } = usePaginatedList({
    url: `${backendUrl}/api/lessons`,
    dataKey: "lessons",
    initialFilters: { search: "", year: "" },
  });

  /*
  |--------------------------------------------------------------------------
  | Search
  |--------------------------------------------------------------------------
  */

  const handleSearch = (e) => {
    e.preventDefault();

    setFilters({ search, year: yearFilter });
  };

  const clearFilters = () => {
    setSearch("");
    setYearFilter("0");

    setFilters({ search: "", year: "" });
  };

  /*
  |--------------------------------------------------------------------------
  | Delete
  |--------------------------------------------------------------------------
  */

  const deleteLessonHandler =
    async (lessonId) => {
      const confirmDelete =
        window.confirm(
          "Are you sure you want to delete this lesson?"
        );

      if (!confirmDelete) return;

      try {
        const { data } =
          await axios.delete(
            `${backendUrl}/api/lessons/${lessonId}`
          );

        if (data.success) {
          toast.success(
            data.message ||
              "Lesson deleted successfully"
          );

          refresh();
        } else {
          toast.error(
            data.message ||
              "Failed to delete lesson"
          );
        }
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            error.message
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Navigation
  |--------------------------------------------------------------------------
  */

  const handleViewLesson = (
    lesson
  ) => {
    navigate(
      `/lessons/${lesson._id}`
    );
  };

  const handleEditLesson = (
    lesson
  ) => {
    navigate(
      `/lessons/${lesson._id}/edit`
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="lessons-page relative isolate text-gray-900 bg-transparent">
      <Navbar />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-transparent">
        {/* Desktop Visual */}

        <div className="relative hidden overflow-hidden lg:block">

          <div className="relative z-10 flex h-screen items-center justify-center px-12">
            <div className="max-w-md">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
                Saint George Church
                Lessons
              </p>

              <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
              An intelligent heart
              acquires knowledge,
              and the ear of the wise
              seeks knowledge.
              </h1>
            </div>
          </div>
        </div>

        {/* Main */}

        <main className="min-w-0 px-4 pb-10 pt-40 sm:px-8 lg:px-12 lg:pb-28 lg:pt-38 xl:px-16">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
            {/* Header */}

            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Lessons
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500 sm:text-base">
                Search lessons, filter
                them by year, and manage
                them based on your role.
              </p>
            </div>

            {/* Search */}

            <form
              onSubmit={handleSearch}
              className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              <input
                type="text"
                placeholder="Search lesson content"
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 md:col-span-2"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                max="12"
                step="1"
                aria-label="Filter by year (1–12; 0 for all years)"
                title="Year 1–12; 0 shows all years"
                placeholder="Year 1–12 (0 = all)"
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                value={yearFilter}
                onChange={(e) =>
                  setYearFilter(
                    e.target.value
                  )
                }
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

              {canManageLessons && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/create-lesson"
                    )
                  }
                  className="h-12 w-full rounded-xl bg-black text-sm font-medium text-white shadow-md transition hover:bg-gray-700 md:col-span-2 xl:col-span-1"
                >
                  Create Lesson
                </button>
              )}
            </form>

            {/* Notice */}

            {!canManageLessons &&
              isLoggedin && (
                <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600 sm:p-5">
                  Enjoy Reading The
                  Lessons.
                </div>
              )}

            {/* Lessons */}

            <section aria-label="Lesson results" aria-busy={loading} className="mt-8 sm:mt-10">
              {loading && lessons.length > 0 && <p role="status" className="sr-only">Updating lessons...</p>}
              {loading && lessons.length === 0 ? (
                <>
                  <p role="status" className="sr-only">Loading lessons...</p>
                  <div aria-hidden="true" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {Array.from({ length: pagination.pageSize }, (_, index) => (
                      <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="h-40 bg-gray-100 sm:h-48 lg:h-56" />
                        <div className="p-4 sm:p-6">
                          <div className="h-14 rounded-lg bg-gray-100" />
                          <div className="mt-1 h-5 w-2/3 rounded bg-gray-100" />
                          <div className="mt-6 h-12 rounded-xl bg-gray-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : lessons.length ===
                0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 sm:p-6">
                  No lessons found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {lessons.map(
                    (lesson) => {
                      return (
                        <article
                          key={
                            lesson._id
                          }
                          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                        >
                          {/* Image */}

                          {lesson.image && (
                            <ContentImage
                              thumbnail
                              loading="lazy"
                              decoding="async"
                              src={
                                lesson.image
                              }
                              alt={
                                lesson.title
                              }
                              className="h-40 w-full object-cover sm:h-48 lg:h-56"
                            />
                          )}

                          {/* Body */}

                          <div className="p-4 sm:p-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h3 className="break-words text-xl font-semibold text-gray-900 sm:text-2xl">
                                  {
                                    lesson.title
                                  }
                                </h3>

                                <p className="mt-1 text-sm text-gray-500">
                                  {
                                    lesson.name
                                  }
                                </p>
                              </div>

                              {canManageLessons && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteLessonHandler(
                                      lesson._id
                                    )
                                  }
                                  className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:w-auto"
                                >
                                  Delete
                                </button>
                              )}
                            </div>

                            {/* Actions */}

                            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  handleViewLesson(
                                    lesson
                                  )
                                }
                                className="w-full rounded-xl border-2 border-black px-6 py-2 text-base font-semibold text-black transition hover:bg-gray-100 sm:w-auto"
                              >
                                View
                              </button>

                              {canManageLessons && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEditLesson(
                                      lesson
                                    )
                                  }
                                  className="w-full rounded-xl bg-indigo-600 px-6 py-2 text-base font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
              <Pagination pagination={pagination} onPageChange={setPage} loading={loading} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Lessons;
