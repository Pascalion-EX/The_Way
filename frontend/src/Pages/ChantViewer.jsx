import React, { useContext, useEffect, useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";
import { AppContent } from "../Context/AppContext.jsx";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import jsPDF from "jspdf";

const ChantViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { backendUrl, userData } = useContext(AppContent);

  const [chant, setChant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("arabic");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [projectorMode, setProjectorMode] = useState(false);

  const allowedRoles = ["admin", "leader", "pascal"];

  const canManageChants = allowedRoles.some((role) =>
    Array.isArray(userData?.role)
      ? userData.role.includes(role)
      : userData?.role === role
  );

  const fetchChant = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(`${backendUrl}/api/chants/${id}`);

      if (data.success) {
        setChant(data.chant);

        if (data.chant.lyrics?.arabic) {
          setLanguage("arabic");
        } else if (data.chant.lyrics?.coptic) {
          setLanguage("coptic");
        } else {
          setLanguage("english");
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      navigate("/chants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChant();
  }, [id]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [language]);

  const selectedLyrics = chant?.lyrics?.[language] || "";

  const slides = useMemo(() => {
    return selectedLyrics
      .split(/\n\s*\n/)
      .map((slide) => slide.trim())
      .filter(Boolean);
  }, [selectedLyrics]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleFullScreen = () => {
    const element = document.documentElement;

    if (!document.fullscreenElement) {
      element.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const downloadPDF = () => {
    if (!chant) return;

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(chant.title, 15, 20);

    doc.setFontSize(12);
    doc.text(`Category: ${chant.category}`, 15, 32);
    doc.text(`Language: ${language}`, 15, 42);

    const text = selectedLyrics || "No lyrics available";
    const splitText = doc.splitTextToSize(text, 180);

    doc.text(splitText, 15, 55);
    doc.save(`${chant.title}-${language}.pdf`);
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this chant?"
    );

    if (!confirmDelete) return;

    try {
      axios.defaults.withCredentials = true;

      const { data } = await axios.delete(`${backendUrl}/api/chants/${id}`);

      if (data.success) {
        toast.success(data.message);
        navigate("/chants");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === "Escape") setProjectorMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        <Waves />
        <Navbar />
        <div className="relative z-10 flex items-center justify-center min-h-[70vh] text-gray-700 font-semibold">
          Loading chant...
        </div>
      </div>
    );
  }

  if (!chant) return null;

  const hasLanguage = (lang) => chant.lyrics?.[lang]?.trim();

  if (projectorMode) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10">
          <button
            onClick={() => setProjectorMode(false)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Exit Projector
          </button>

          <span className="text-sm text-white/70">
            Slide {slides.length ? currentSlide + 1 : 0} / {slides.length}
          </span>

          <button
            onClick={handleFullScreen}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Full Screen
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-12">
            {chant.title}
          </h1>

          <p
            dir={language === "arabic" ? "rtl" : "ltr"}
            className="text-4xl md:text-6xl leading-relaxed whitespace-pre-line max-w-6xl font-semibold"
          >
            {slides[currentSlide] || "No lyrics available"}
          </p>
        </div>

        <div className="flex justify-center gap-4 px-5 py-6">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="px-6 py-3 rounded-xl bg-white/10 disabled:opacity-40 hover:bg-white/20 transition"
          >
            Previous
          </button>

          <button
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="px-6 py-3 rounded-xl bg-white/10 disabled:opacity-40 hover:bg-white/20 transition"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
              <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(110, 110, 110, 0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={60}
          waveAmpY={40}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      <Navbar />

      <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-38 lg:pb-28">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-3xl shadow-lg p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-8">
            <div>
              <button
                onClick={() => navigate("/chants")}
                className="text-gray-600 hover:text-gray-900 mb-4"
              >
                ← Back to Chants
              </button>

              <h1 className="text-3xl sm:text-5xl font-bold text-gray-900">
                {chant.title}
              </h1>

              <p className="mt-3 text-gray-600">
                Category:{" "}
                <span className="font-semibold text-gray-900">
                  {chant.category}
                </span>
              </p>
            </div>

            {canManageChants && (
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/edit-chant/${chant._id}`)}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Edit
                </button>

                <button
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {(chant.audio || chant.video) && (
            <div className="mb-8 space-y-4">
              {chant.audio && (
                <audio controls className="w-full">
                  <source src={chant.audio} />
                </audio>
              )}

              {chant.video && (
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-gray-200">
                  <iframe
                    src={chant.video}
                    title={chant.title}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              disabled={!hasLanguage("arabic")}
              onClick={() => setLanguage("arabic")}
              className={`px-4 py-2 rounded-lg border transition disabled:opacity-40 ${
                language === "arabic"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Arabic
            </button>

            <button
              disabled={!hasLanguage("coptic")}
              onClick={() => setLanguage("coptic")}
              className={`px-4 py-2 rounded-lg border transition disabled:opacity-40 ${
                language === "coptic"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              Coptic
            </button>

            <button
              disabled={!hasLanguage("english")}
              onClick={() => setLanguage("english")}
              className={`px-4 py-2 rounded-lg border transition disabled:opacity-40 ${
                language === "english"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              English
            </button>
          </div>

          <div className="bg-gray-900 text-white rounded-3xl min-h-[420px] flex flex-col items-center justify-center text-center px-6 py-12">
            <p className="text-sm text-white/60 mb-6">
              Slide {slides.length ? currentSlide + 1 : 0} / {slides.length}
            </p>

            <p
              dir={language === "arabic" ? "rtl" : "ltr"}
              className="text-2xl md:text-4xl leading-relaxed whitespace-pre-line max-w-5xl font-semibold"
            >
              {slides[currentSlide] || "No lyrics available"}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="px-5 py-3 rounded-xl bg-gray-200 text-gray-800 disabled:opacity-40 hover:bg-gray-300 transition"
            >
              Previous
            </button>

            <button
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
              className="px-5 py-3 rounded-xl bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-800 transition"
            >
              Next
            </button>

            <button
              onClick={downloadPDF}
              className="px-5 py-3 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-100 transition"
            >
              Download PDF
            </button>

            <button
              onClick={handleFullScreen}
              className="px-5 py-3 rounded-xl bg-white border border-gray-300 text-gray-800 hover:bg-gray-100 transition"
            >
              Full Screen
            </button>

            <button
              onClick={() => setProjectorMode(true)}
              className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-800 transition"
            >
              Projector Mode
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm mt-5">
            Use keyboard arrows to move between slides.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ChantViewer;