import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";

const ChantCard = ({ chant, refreshChants }) => {
  const navigate = useNavigate();
  const { userData, backendUrl } = useContext(AppContent);

  const allowedRoles = ["admin", "leader", "pascal"];

  const canManageChants = allowedRoles.some((role) =>
    Array.isArray(userData?.role)
      ? userData.role.includes(role)
      : userData?.role === role
  );

  const isFavorite = chant.favorites?.some(
    (id) => id?.toString() === userData?._id?.toString()
  );

  const handleFavorite = async (e) => {
    e.stopPropagation();

    if (!userData) {
      toast.error("Please login first");
      return;
    }

    try {
      axios.defaults.withCredentials = true;

      const { data } = await axios.patch(
        `${backendUrl}/api/chants/${chant._id}/favorite`
      );

      if (data.success) {
        toast.success(data.message);
        refreshChants();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this chant?"
    );

    if (!confirmDelete) return;

    try {
      axios.defaults.withCredentials = true;

      const { data } = await axios.delete(
        `${backendUrl}/api/chants/${chant._id}`
      );

      if (data.success) {
        toast.success(data.message);
        refreshChants();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const getPreviewLyrics = () => {
    return (
      chant.lyrics?.english ||
      chant.lyrics?.arabic ||
      chant.lyrics?.coptic ||
      "No lyrics available"
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
      <div
        onClick={() => navigate(`/chants/${chant._id}`)}
        className="cursor-pointer"
      >
        {chant.image ? (
          <img
            src={chant.image}
            alt={chant.title}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-500 font-semibold">
            No Image
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div
          onClick={() => navigate(`/chants/${chant._id}`)}
          className="cursor-pointer flex-1"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 line-clamp-2">
              {chant.title}
            </h2>

            <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full whitespace-nowrap">
              {chant.category}
            </span>
          </div>

          <p className="text-gray-600 mt-3 line-clamp-3 whitespace-pre-line">
            {getPreviewLyrics()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            onClick={() => navigate(`/chants/${chant._id}`)}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 transition"
          >
            Open
          </button>

          <button
            onClick={handleFavorite}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              isFavorite
                ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {isFavorite ? "★ Favorite" : "☆ Favorite"}
          </button>

          {canManageChants && (
            <>
              <button
                onClick={() => navigate(`/edit-chant/${chant._id}`)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
              >
                Edit
              </button>

              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChantCard;