import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import Navbar from "@/Components/Navbar.jsx";
import Waves from "../Components/Waves.jsx";

const getEmbedUrl = (url = "") => {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace("www.", "");

    if (hostname === "youtube.com") {
      if (parsedUrl.pathname.startsWith("/embed/")) {
        return url;
      }

      if (parsedUrl.pathname.startsWith("/shorts/")) {
        const videoId = parsedUrl.pathname
          .replace("/shorts/", "")
          .split("/")[0];

        return videoId
          ? `https://www.youtube.com/embed/${videoId}`
          : url;
      }

      const videoId = parsedUrl.searchParams.get("v");

      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : url;
    }

    if (hostname === "youtu.be") {
      const videoId = parsedUrl.pathname
        .replace("/", "")
        .split("/")[0];

      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : url;
    }

    return url;
  } catch {
    return url;
  }
};

/*
|--------------------------------------------------------------------------
| Normalize Lesson Partitions
|--------------------------------------------------------------------------
|
| New lessons use lesson.partitions.
| Old lessons may only have lesson.body.
|
*/

const getLessonPartitions = (lesson) => {
  if (
    Array.isArray(lesson?.partitions) &&
    lesson.partitions.length > 0
  ) {
    return lesson.partitions;
  }

  if (lesson?.body) {
    return [
      {
        title: "Lesson Body",
        body: lesson.body,
      },
    ];
  }

  return [];
};

const LessonViewer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const lesson = location.state?.lesson;

  const [downloading, setDownloading] =
    useState(false);

  const partitions = getLessonPartitions(lesson);

  /*
  |--------------------------------------------------------------------------
  | PDF Download
  |--------------------------------------------------------------------------
  */

  const handleDownloadPdf = async () => {
    if (!lesson || downloading) return;

    try {
      setDownloading(true);

      const pdf = new jsPDF(
        "p",
        "mm",
        "a4"
      );

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const margin = 15;

      const contentWidth =
        pageWidth - margin * 2;

      let y = 20;

      const safeTitle = (
        lesson.title || "lesson"
      )
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_")
        .toLowerCase();

      /*
      |--------------------------------------------------------------------------
      | PDF Helpers
      |--------------------------------------------------------------------------
      */

      const checkPageSpace = (
        requiredHeight = 15
      ) => {
        if (
          y + requiredHeight >
          pageHeight - 15
        ) {
          pdf.addPage();
          y = 20;
        }
      };

      const addWrappedText = (
        text,
        fontSize = 12,
        lineHeight = 8
      ) => {
        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(fontSize);

        const lines =
          pdf.splitTextToSize(
            text || "Not provided.",
            contentWidth
          );

        lines.forEach((line) => {
          checkPageSpace(lineHeight);

          pdf.text(line, margin, y);

          y += lineHeight;
        });
      };

      const addSectionTitle = (
        title,
        fontSize = 15
      ) => {
        checkPageSpace(18);

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(fontSize);

        const lines =
          pdf.splitTextToSize(
            title,
            contentWidth
          );

        lines.forEach((line) => {
          checkPageSpace(8);

          pdf.text(line, margin, y);

          y += 8;
        });

        y += 2;
      };

      const addDivider = () => {
        checkPageSpace(10);

        y += 3;

        pdf.setDrawColor(210);

        pdf.line(
          margin,
          y,
          pageWidth - margin,
          y
        );

        y += 8;
      };

      /*
      |--------------------------------------------------------------------------
      | PDF Header
      |--------------------------------------------------------------------------
      */

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(11);

      pdf.text(
        "LESSON",
        margin,
        y
      );

      y += 12;

      pdf.setFontSize(24);

      const titleLines =
        pdf.splitTextToSize(
          lesson.title ||
            "Untitled Lesson",
          contentWidth
        );

      pdf.text(
        titleLines,
        margin,
        y
      );

      y +=
        titleLines.length * 10 + 6;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(11);

      const lessonInformation = [
        lesson.name,
        lesson.year
          ? `Year ${lesson.year}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");

      if (lessonInformation) {
        pdf.text(
          lessonInformation,
          margin,
          y
        );

        y += 12;
      }

      addDivider();

      /*
      |--------------------------------------------------------------------------
      | PDF Partitions
      |--------------------------------------------------------------------------
      */

      partitions.forEach(
        (partition, index) => {
          if (index > 0) {
            y += 4;
          }

          addSectionTitle(
            partition.title ||
              `Partition ${index + 1}`
          );

          addWrappedText(
            partition.body
          );

          if (
            index <
            partitions.length - 1
          ) {
            addDivider();
          }
        }
      );

      /*
      |--------------------------------------------------------------------------
      | Activity
      |--------------------------------------------------------------------------
      */

      if (lesson.activity) {
        y += 8;

        addDivider();

        addSectionTitle(
          "Lesson Activity"
        );

        addWrappedText(
          lesson.activity
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Video Link
      |--------------------------------------------------------------------------
      */

      if (lesson.video) {
        y += 8;

        addDivider();

        addSectionTitle(
          "Video Link"
        );

        addWrappedText(
          lesson.video,
          10,
          7
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Save
      |--------------------------------------------------------------------------
      */

      pdf.save(
        `${safeTitle || "lesson"}.pdf`
      );
    } catch (error) {
      console.error(
        "PDF download failed:",
        error
      );

      alert(
        "PDF download failed. Please check the console."
      );
    } finally {
      setDownloading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Background
  |--------------------------------------------------------------------------
  */

  const renderBackground = () => (
    <>
      <div className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-[clamp(120px,18vw,320px)] scale-x-[-1] lg:block">
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
          xGap={15}
          yGap={25}
        />
      </div>

      <div className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-[clamp(120px,18vw,320px)] lg:block">
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
          xGap={15}
          yGap={25}
        />
      </div>
    </>
  );

  /*
  |--------------------------------------------------------------------------
  | Navbar
  |--------------------------------------------------------------------------
  */

  const renderNavbar = () => (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[9999]">
      <div className="pointer-events-auto relative z-[9999]">
        <Navbar />
      </div>
    </header>
  );

  /*
  |--------------------------------------------------------------------------
  | Lesson Missing
  |--------------------------------------------------------------------------
  */

  if (!lesson) {
    return (
      <div className="relative isolate min-h-screen overflow-x-hidden bg-white text-gray-900">
        {renderBackground()}
        {renderNavbar()}

        <main className="relative z-10 px-4 pb-12 pt-52 sm:px-8 sm:pt-48 lg:px-16 lg:pb-28 lg:pt-44">
          <div className="mx-auto w-full max-w-[900px]">
            <button
              type="button"
              onClick={() =>
                navigate("/lessons")
              }
              className="relative z-20 mb-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-400 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              ← Back to lessons
            </button>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500">
                Lesson
              </p>

              <h1 className="mt-4 text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
                Lesson not found
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
                Open the lesson again
                from the lessons page.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const embedUrl =
    getEmbedUrl(lesson.video);

  const isYouTubeVideo =
    embedUrl.includes(
      "youtube.com/embed"
    );

  /*
  |--------------------------------------------------------------------------
  | Main Viewer
  |--------------------------------------------------------------------------
  */

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-white text-gray-900">
      {renderBackground()}
      {renderNavbar()}

      <main className="relative z-10 px-4 pb-12 pt-52 sm:px-8 sm:pt-48 lg:px-16 lg:pb-28 lg:pt-44">
        <div className="mx-auto w-full max-w-[900px]">
          {/* Controls */}

          <div className="relative z-20 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() =>
                navigate("/lessons")
              }
              className="pointer-events-auto inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-gray-400 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:w-auto"
            >
              ← Back to lessons
            </button>

            <button
              type="button"
              onClick={
                handleDownloadPdf
              }
              disabled={downloading}
              className="pointer-events-auto w-full cursor-pointer rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto"
            >
              {downloading
                ? "Preparing PDF..."
                : "Download PDF"}
            </button>
          </div>

          {/* Lesson */}

          <article className="relative z-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {lesson.image && (
              <img
                src={lesson.image}
                alt={
                  lesson.title ||
                  "Lesson"
                }
                className="h-44 w-full object-cover sm:h-72 lg:h-[420px]"
              />
            )}

            <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500">
                Lesson
              </p>

              <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
                {lesson.title}
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {[
                  lesson.name,
                  lesson.year &&
                    `Year ${lesson.year}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="mt-6 h-px w-full bg-gray-300 sm:mt-8" />

              {/* Modular partitions */}

              <div className="divide-y divide-gray-200">
                {partitions.length > 0 ? (
                  partitions.map(
                    (
                      partition,
                      index
                    ) => (
                      <section
                        key={
                          partition._id ||
                          index
                        }
                        className="py-8 sm:py-10"
                      >
                        <div className="flex items-start gap-4">
                          <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                            {index + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <h2 className="break-words text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">
                              {
                                partition.title
                              }
                            </h2>

                            <p className="mt-5 whitespace-pre-line break-words text-base leading-8 text-gray-800 sm:text-[18px] sm:leading-10">
                              {
                                partition.body
                              }
                            </p>
                          </div>
                        </div>
                      </section>
                    )
                  )
                ) : (
                  <section className="py-8">
                    <p className="text-sm text-gray-500">
                      No lesson content
                      available.
                    </p>
                  </section>
                )}
              </div>

              {/* Activity */}

              {lesson.activity && (
                <section className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Lesson Activity
                  </h2>

                  <p className="mt-4 whitespace-pre-line break-words text-base leading-8 text-gray-800">
                    {lesson.activity}
                  </p>
                </section>
              )}

              {/* Video */}

              {lesson.video && (
                <section className="mt-8">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Lesson Video
                  </h2>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
                    {isYouTubeVideo ? (
                      <iframe
                        src={
                          embedUrl
                        }
                        title={`${
                          lesson.title ||
                          "Lesson"
                        } video`}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={
                          lesson.video
                        }
                        controls
                        className="aspect-video w-full bg-black"
                      >
                        Your browser
                        does not support
                        the video element.
                      </video>
                    )}
                  </div>

                  <a
                    href={lesson.video}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-20 mt-3 inline-block break-all text-sm font-medium text-indigo-600 hover:underline"
                  >
                    Open video link
                  </a>
                </section>
              )}
            </div>
          </article>
        </div>
      </main>
    </div>
  );
};

export default LessonViewer;