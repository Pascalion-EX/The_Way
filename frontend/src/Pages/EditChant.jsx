import React, { useContext, useEffect, useState } from "react";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";
import { AppContent } from "../Context/AppContext.jsx";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../utils/axios";
import { toast } from "react-toastify";

const EditChant = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { backendUrl } = useContext(AppContent);

  const [formData, setFormData] = useState({
    title: "",
    category: "Other",
    image: "",
    audio: "",
    video: "",
    lyrics: {
      arabic: "",
      coptic: "",
      english: "",
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchChant = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(`${backendUrl}/api/chants/${id}`);

      if (data.success) {
        setFormData({
          title: data.chant.title || "",
          category: data.chant.category || "Other",
          image: data.chant.image || "",
          audio: data.chant.audio || "",
          video: data.chant.video || "",
          lyrics: {
            arabic: data.chant.lyrics?.arabic || "",
            coptic: data.chant.lyrics?.coptic || "",
            english: data.chant.lyrics?.english || "",
          },
        });
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

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (["arabic", "coptic", "english"].includes(name)) {
      setFormData((prev) => ({
        ...prev,
        lyrics: {
          ...prev.lyrics,
          [name]: value,
        },
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (
      !formData.lyrics.arabic.trim() &&
      !formData.lyrics.coptic.trim() &&
      !formData.lyrics.english.trim()
    ) {
      toast.error("At least one lyrics language is required");
      return;
    }

    try {
      setSaving(true);
      axios.defaults.withCredentials = true;

      const { data } = await axios.put(
        `${backendUrl}/api/chants/${id}`,
        formData
      );

      if (data.success) {
        toast.success(data.message);
        navigate(`/chants/${id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gray-50">
        <Waves />
        <Navbar />
        <div className="relative z-10 flex items-center justify-center min-h-[70vh] text-gray-700 font-semibold">
          Loading chant...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50">
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
          <button
            onClick={() => navigate(`/chants/${id}`)}
            className="text-gray-600 hover:text-gray-900 mb-5"
          >
            ← Back to Chant
          </button>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Edit Chant
          </h1>

          <p className="text-gray-600 mb-8">
            Empty lines separate the chant into presentation slides.
          </p>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Title
              </label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter chant title"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="Praise">Praise</option>
                <option value="Worship">Worship</option>
                <option value="Kids">Kids</option>
                <option value="Mass">Mass</option>
                <option value="Tasbeha">Tasbeha</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Image URL
                </label>
                <input
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                  placeholder="Optional image URL"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Audio URL
                </label>
                <input
                  name="audio"
                  value={formData.audio}
                  onChange={handleChange}
                  placeholder="Optional audio URL"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Video Embed URL
                </label>
                <input
                  name="video"
                  value={formData.video}
                  onChange={handleChange}
                  placeholder="Optional video embed URL"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Arabic Lyrics
              </label>
              <textarea
                name="arabic"
                value={formData.lyrics.arabic}
                onChange={handleChange}
                dir="rtl"
                className="w-full min-h-[180px] px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                Coptic Lyrics
              </label>
              <textarea
                name="coptic"
                value={formData.lyrics.coptic}
                onChange={handleChange}
                className="w-full min-h-[180px] px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">
                English Lyrics
              </label>
              <textarea
                name="english"
                value={formData.lyrics.english}
                onChange={handleChange}
                className="w-full min-h-[180px] px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={() => navigate(`/chants/${id}`)}
                className="px-6 py-3 rounded-xl bg-white border border-gray-300 text-gray-800 font-semibold hover:bg-gray-100 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default EditChant;