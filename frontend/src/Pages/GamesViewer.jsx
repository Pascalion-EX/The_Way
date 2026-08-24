import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import Navbar from "../Components/Navbar.jsx";
import Waves from "../Components/Waves.jsx";

const getEmbedUrl = (url = "") => {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtube.com")) {
      if (parsedUrl.pathname.includes("/embed/")) {
        return url;
      }

      if (parsedUrl.pathname.includes("/shorts/")) {
        const videoId = parsedUrl.pathname.split("/shorts/")[1]?.split("/")[0];

        return videoId
          ? `https://www.youtube.com/embed/${videoId}`
          : url;
      }

      const videoId = parsedUrl.searchParams.get("v");

      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : url;
    }

    if (parsedUrl.hostname.includes("youtu.be")) {
      const videoId = parsedUrl.pathname.replace("/", "").split("?")[0];

      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : url;
    }

    return url;
  } catch {
    return url;
  }
};

const GameViewer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const game = location.state?.game;

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!game || downloading) return;

    try {
      setDownloading(true);

      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      let y = 20;

      const safeFileName = (game.name || "game")
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_")
        .toLowerCase();

      const checkPageSpace = (requiredHeight = 15) => {
        if (y + requiredHeight > pageHeight - 15) {
          pdf.addPage();
          y = 20;
        }
      };

      const addWrappedText = (
        text,
        fontSize = 12,
        lineHeight = 8
      ) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);

        const lines = pdf.splitTextToSize(
          text || "Not provided.",
          contentWidth
        );

        lines.forEach((line) => {
          checkPageSpace(lineHeight);

          pdf.text(line, margin, y);
          y += lineHeight;
        });
      };

      const addSectionTitle = (title) => {
        checkPageSpace(20);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title, margin, y);

        y += 9;
      };

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Game", margin, y);

      y += 12;

      pdf.setFontSize(24);

      const titleLines = pdf.splitTextToSize(
        game.name || "Untitled Game",
        contentWidth
      );

      pdf.text(titleLines, margin, y);

      y += titleLines.length * 10 + 7;

      pdf.setDrawColor(190);
      pdf.line(margin, y, pageWidth - margin, y);

      y += 13;

      addSectionTitle("Materials");
      addWrappedText(game.materials);

      y += 7;

      addSectionTitle("How to Play");
      addWrappedText(game.explanation);

      if (game.video) {
        y += 7;

        addSectionTitle("Video Link");
        addWrappedText(game.video, 10, 7);
      }

      pdf.save(`${safeFileName || "game"}.pdf`);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert("PDF download failed. Please check the console.");
    } finally {
      setDownloading(false);
    }
  };

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

  if (!game) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-white text-gray-900">
        {renderBackground()}

        <div className="relative z-30">
          <Navbar />
        </div>

        <main className="relative z-10 px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
          <div className="mx-auto w-full max-w-[900px]">
            <button
              type="button"
              onClick={() => navigate("/games")}
              className="relative z-20 mb-6 inline-flex items-center gap-2 rounded-full border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              ← Back to games
            </button>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500">
                Game
              </p>

              <h1 className="mt-4 text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
                Game not found
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
                Open the game again from the games page.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const embedUrl = getEmbedUrl(game.video);
  const isYouTubeVideo = embedUrl.includes("youtube.com/embed");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white text-gray-900">
      {renderBackground()}

      <div className="relative z-30">
        <Navbar />
      </div>

      <main className="relative z-10 px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
        <div className="mx-auto w-full max-w-[900px]">
          <div className="relative z-20 mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => navigate("/games")}
              className="pointer-events-auto relative z-20 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-gray-400 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:w-auto"
            >
              ← Back to games
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="pointer-events-auto relative z-20 w-full cursor-pointer rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto"
            >
              {downloading
                ? "Preparing PDF..."
                : "Download PDF"}
            </button>
          </div>

          <article className="relative z-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {game.image && (
              <img
                src={game.image}
                alt={game.name || "Game"}
                className="h-44 w-full object-cover sm:h-72 lg:h-[420px]"
              />
            )}

            <div className="px-4 py-6 sm:px-8 sm:py-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gray-500">
                Game
              </p>

              <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
                {game.name}
              </h1>

              <div className="mt-6 h-px w-full bg-gray-300 sm:mt-8" />

              <section className="pt-6 sm:pt-10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Materials
                </h2>

                <p className="mt-4 whitespace-pre-line break-words text-base leading-8 text-gray-800 sm:text-[18px] sm:leading-10">
                  {game.materials}
                </p>
              </section>

              <section className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                  How to Play
                </h2>

                <p className="mt-4 whitespace-pre-line break-words text-base leading-8 text-gray-800 sm:text-[18px] sm:leading-10">
                  {game.explanation}
                </p>
              </section>

              {game.video && (
                <section className="mt-8">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Game Video
                  </h2>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
                    {isYouTubeVideo ? (
                      <iframe
                        src={embedUrl}
                        title={`${game.name || "Game"} video`}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={game.video}
                        controls
                        className="aspect-video w-full bg-black"
                      >
                        Your browser does not support the video element.
                      </video>
                    )}
                  </div>

                  <a
                    href={game.video}
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

export default GameViewer;