import React, {
  useContext,
  useEffect,
  useMemo,
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
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700">
            Saint George Church Games
          </p>

          <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
            Update and maintain the games used in the service.
          </h1>

          <p className="mt-5 text-base leading-7 text-gray-600">
            Edit the materials, instructions, image, or video while preserving
            the existing game.
          </p>
        </div>
      </div>
    </div>
  );
};

const EditGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const {
    backendUrl,
    userData,
  } = useContext(AppContent);

  const passedGame = location.state?.game;

  const [game, setGame] = useState(
    passedGame || null
  );

  const [name, setName] = useState(
    passedGame?.name || ""
  );

  const [materials, setMaterials] = useState(
    passedGame?.materials || ""
  );

  const [explanation, setExplanation] =
    useState(
      passedGame?.explanation || ""
    );

  const [image, setImage] = useState(
    passedGame?.image || ""
  );

  const [video, setVideo] = useState(
    passedGame?.video || ""
  );

  const [loading, setLoading] = useState(
    !passedGame
  );

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Permissions
  |--------------------------------------------------------------------------
  */

  const allowedRoles = [
    "admin",
    "leader",
    "pascal",
    "pamela",
  ];

  const canEdit = useMemo(() => {
    const rawRoles = userData?.role;

    const roles = Array.isArray(rawRoles)
      ? rawRoles
      : rawRoles
      ? [rawRoles]
      : [];

    return roles
      .map((role) =>
        String(role)
          .trim()
          .toLowerCase()
      )
      .some((role) =>
        allowedRoles.includes(role)
      );
  }, [userData]);

  /*
  |--------------------------------------------------------------------------
  | Fetch Game
  |--------------------------------------------------------------------------
  |
  | If the user refreshes the edit page, location.state disappears.
  | In that case we fetch the game again from the backend.
  |
  */

  useEffect(() => {
    const fetchGame = async () => {
      if (passedGame) return;

      try {
        setLoading(true);

        const { data } = await axios.get(
          `${backendUrl}/api/games/${id}`,
          {
            withCredentials: true,
          }
        );

        if (data.success && data.game) {
          const foundGame = data.game;

          setGame(foundGame);

          setName(
            foundGame.name || ""
          );

          setMaterials(
            foundGame.materials || ""
          );

          setExplanation(
            foundGame.explanation || ""
          );

          setImage(
            foundGame.image || ""
          );

          setVideo(
            foundGame.video || ""
          );
        } else {
          toast.error(
            data.message ||
              "Game not found."
          );
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Failed to load game."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [
    backendUrl,
    id,
    passedGame,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Update Game
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit) {
      toast.error(
        "You are not allowed to edit games."
      );

      return;
    }

    const trimmedName =
      name.trim();

    const trimmedMaterials =
      materials.trim();

    const trimmedExplanation =
      explanation.trim();

    const trimmedImage =
      image.trim();

    const trimmedVideo =
      video.trim();

    if (
      !trimmedName ||
      !trimmedMaterials ||
      !trimmedExplanation
    ) {
      toast.error(
        "Game name, materials, and explanation are required."
      );

      return;
    }

    try {
      setIsSubmitting(true);

      const { data } = await axios.put(
        `${backendUrl}/api/games/${id}`,
        {
          name: trimmedName,
          materials:
            trimmedMaterials,
          explanation:
            trimmedExplanation,
          image: trimmedImage,
          video: trimmedVideo,
        },
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        toast.success(
          data.message ||
            "Game updated successfully."
        );

        navigate("/games");
      } else {
        toast.error(
          data.message ||
            "Failed to update game."
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update game."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                Loading game...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Game Not Found
  |--------------------------------------------------------------------------
  */

  if (!game) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-semibold text-gray-900">
                Game not found
              </h1>

              <p className="mt-3 text-sm text-gray-500">
                The requested game could not be loaded.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/games")
                }
                className="mt-6 h-12 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to Games
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Permission Denied
  |--------------------------------------------------------------------------
  */

  if (!canEdit) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
        <Navbar />

        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
          <DesktopVisual />

          <main className="px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="text-3xl font-semibold text-gray-900">
                Edit Game
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                You do not have permission to edit games.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/games")
                }
                className="mt-6 h-12 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Back to Games
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Edit Form
  |--------------------------------------------------------------------------
  */

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      <Navbar />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <DesktopVisual />

        <main className="px-4 pb-10 pt-40 sm:px-8 lg:px-16 lg:pb-28 lg:pt-28">
          <div className="w-full max-w-3xl">
            {/* Header */}

            <div className="mb-6 sm:mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-gray-500">
                Game Management
              </p>

              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                Edit Game
              </h1>

              <p className="mt-3 text-sm leading-6 text-gray-500 sm:text-base">
                Update the game information, materials, instructions, and
                media.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:border-0 lg:p-0 lg:shadow-none"
            >
              <div className="grid grid-cols-1 gap-5">
                {/* Name */}

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
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    required
                  />
                </div>

                {/* Image */}

                <div>
                  <label
                    htmlFor="game-image"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Image URL
                    <span className="ml-1 font-normal text-gray-400">
                      optional
                    </span>
                  </label>

                  <input
                    id="game-image"
                    type="url"
                    value={image}
                    onChange={(event) =>
                      setImage(
                        event.target.value
                      )
                    }
                    placeholder="https://example.com/game-image.jpg"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Image Preview */}

                {image.trim() && (
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                    <img
                      src={image}
                      alt={
                        name ||
                        "Game preview"
                      }
                      className="h-56 w-full object-cover sm:h-72"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  </div>
                )}

                {/* Video */}

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
                    value={video}
                    onChange={(event) =>
                      setVideo(
                        event.target.value
                      )
                    }
                    placeholder="https://youtube.com/watch?v=..."
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Materials */}

                <div>
                  <label
                    htmlFor="game-materials"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Required materials
                  </label>

                  <textarea
                    id="game-materials"
                    value={materials}
                    onChange={(event) =>
                      setMaterials(
                        event.target.value
                      )
                    }
                    rows={7}
                    disabled={isSubmitting}
                    className="min-h-[180px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-4 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    required
                  />
                </div>

                {/* Explanation */}

                <div>
                  <label
                    htmlFor="game-explanation"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Game explanation
                  </label>

                  <textarea
                    id="game-explanation"
                    value={explanation}
                    onChange={(event) =>
                      setExplanation(
                        event.target.value
                      )
                    }
                    rows={12}
                    disabled={isSubmitting}
                    className="min-h-[280px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-4 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 sm:min-h-[380px]"
                    required
                  />
                </div>
              </div>

              {/* Actions */}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl bg-indigo-600 px-8 text-sm font-medium text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {isSubmitting
                    ? "Updating..."
                    : "Update Game"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/games")
                  }
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-xl border border-gray-300 px-8 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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

export default EditGame;