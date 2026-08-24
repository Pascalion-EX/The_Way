import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import Waves from "../Components/Waves.jsx";
import Navbar from "../Components/Navbar.jsx";

const DesktopVisual = () => {
  return (
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
            Saint George Church Games
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            Create and organize games for the service.
          </h1>

          <p className="mt-5 text-base leading-7 text-gray-600">
            Add the required materials, instructions, images, and optional
            videos for each game.
          </p>
        </div>
      </div>
    </div>
  );
};

const CreateGame = () => {
  const navigate = useNavigate();

  const { backendUrl, userData } = useContext(AppContent);

  const [name, setName] = useState("");
  const [materials, setMaterials] = useState("");
  const [explanation, setExplanation] = useState("");
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowedRoles = ["admin", "leader", 'pascal', 'Pamela'];

  const canCreate = useMemo(() => {
    const rawRoles = userData?.role;

    const normalizedRoles = Array.isArray(rawRoles)
      ? rawRoles.map((role) => String(role).toLowerCase().trim())
      : rawRoles
      ? [String(rawRoles).toLowerCase().trim()]
      : [];

    return normalizedRoles.some((role) => allowedRoles.includes(role));
  }, [userData]);

  const resetForm = () => {
    setName("");
    setMaterials("");
    setExplanation("");
    setImage("");
    setVideo("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canCreate) {
      toast.error("You are not allowed to create games.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedMaterials = materials.trim();
    const trimmedExplanation = explanation.trim();
    const trimmedImage = image.trim();
    const trimmedVideo = video.trim();

    if (
      !trimmedName ||
      !trimmedMaterials ||
      !trimmedExplanation ||
      !trimmedImage
    ) {
      toast.error(
        "Game name, materials, explanation, and image are required."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        name: trimmedName,
        materials: trimmedMaterials,
        explanation: trimmedExplanation,
        image: trimmedImage,
      };

      if (trimmedVideo) {
        payload.video = trimmedVideo;
      }

      const { data } = await axios.post(
        `${backendUrl}/api/games/create`,
        payload,
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        toast.success(data.message || "Game created successfully.");

        resetForm();
        navigate("/games");
      } else {
        toast.error(data.message || "Failed to create game.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to create game."
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

          <main className="px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Game
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Only admins, leaders, pascals, and Pamela can create games.
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate("/games")}
                  className="h-12 w-full rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back to Games
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

        <main className="px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
          <div className="w-full max-w-3xl">
            <div className="mb-6 sm:mb-8">
              <h1 className="break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Create Game
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Add a new game with its materials, instructions, image, and
                optional video.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:border-0 lg:p-0 lg:shadow-none"
            >
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label
                    htmlFor="game-name"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Game name
                  </label>

                  <input
                    id="game-name"
                    type="text"
                    placeholder="Enter the game name"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="game-image"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Image URL
                  </label>

                  <input
                    id="game-image"
                    type="url"
                    placeholder="https://example.com/game-image.jpg"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={image}
                    onChange={(event) => setImage(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="game-video"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Video URL
                    <span className="ml-1 font-normal text-gray-400">
                      optional
                    </span>
                  </label>

                  <input
                    id="game-video"
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={video}
                    onChange={(event) => setVideo(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {image.trim() && (
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <img
                      src={image}
                      alt="Game preview"
                      className="h-56 w-full object-cover sm:h-72"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="game-materials"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Required materials
                  </label>

                  <textarea
                    id="game-materials"
                    placeholder={`List the required materials.\n\nExample:\n- Two balls\n- Four cones\n- Paper and pens`}
                    rows={7}
                    className="min-h-[180px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-4 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={materials}
                    onChange={(event) => setMaterials(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="game-explanation"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Game explanation
                  </label>

                  <textarea
                    id="game-explanation"
                    placeholder="Explain how to prepare and play the game..."
                    rows={12}
                    className="min-h-[280px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-4 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:min-h-[380px]"
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {isSubmitting ? "Creating..." : "Create Game"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/games")}
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl border border-gray-300 px-8 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  Back to Games
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl border border-gray-300 px-8 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CreateGame;