import Pagination from "../Components/Pagination.jsx";
import usePaginatedList from "../hooks/usePaginatedList.js";
import React, { useContext } from "react";
import Navbar from "../Components/Navbar";

import ChantCard from "../Components/chantCard.jsx";
import { AppContent } from "../Context/AppContent.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Chants = () => {
  const navigate = useNavigate();
  const { backendUrl, userData } = useContext(AppContent);

  const {
    items: chants, loading, pagination, setPage, setFilters, refresh,
    filters: { search, category, favoriteOnly },
  } = usePaginatedList({
    url: `${backendUrl}/api/chants`,
    dataKey: "chants",
    initialFilters: { search: "", category: "All", favoriteOnly: false },
    debounce: 300,
  });

  const allowedRoles = ["admin", "leader", "pascal", "pamela"];

  const canManageChants = allowedRoles.some((role) =>
    Array.isArray(userData?.role)
      ? userData.role.includes(role)
      : userData?.role === role
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-transparent">
              
      <Navbar />
      <br/>

      <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-38 lg:pb-28">
        <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-3xl shadow-lg p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Chants
              </h1>
              <p className="text-gray-600 mt-2">
                Search, view, favorite, and present church chants.
              </p>
            </div>

            {canManageChants && (
              <button
                onClick={() => navigate("/create-chant")}
                className="px-5 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
              >
                Create Chant
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <input
              value={search}
              onChange={(e) => setFilters((previous) => ({ ...previous, search: e.target.value }))}
              placeholder="Search by title..."
              className="md:col-span-2 w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />

            <select
              value={category}
              onChange={(e) => setFilters((previous) => ({ ...previous, category: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="All">All Categories</option>
              <option value="Praise">Praise</option>
              <option value="Worship">Worship</option>
              <option value="Kids">Kids</option>
              <option value="Mass">Mass</option>
              <option value="Tasbeha">Tasbeha</option>
              <option value="Other">Other</option>
            </select>

            <button
              onClick={() => {
                if (!userData) {
                  toast.error("Please login first");
                  return;
                }

                setFilters((previous) => ({ ...previous, favoriteOnly: !previous.favoriteOnly }));
              }}
              className={`px-4 py-3 rounded-xl border font-semibold transition ${
                favoriteOnly
                  ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {favoriteOnly ? "Showing Favorites" : "Favorites Only"}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-600 font-semibold">
              Loading chants...
            </div>
          ) : chants.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 border border-gray-200 rounded-2xl">
              <p className="text-gray-700 font-semibold">No chants found.</p>
              <p className="text-gray-500 mt-1">
                Try changing the search or category filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {chants.map((chant) => (
                <ChantCard
                  key={chant._id}
                  chant={chant}
                  refreshChants={refresh}
                />
              ))}
            </div>
          )}
          <Pagination pagination={pagination} onPageChange={setPage} loading={loading} />
        </div>
      </main>
    </div>
  );
};

export default Chants;
