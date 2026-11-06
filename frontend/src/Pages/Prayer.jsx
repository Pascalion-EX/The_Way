import { useContext, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import Navbar from "../Components/Navbar.jsx";
import Pagination from "../Components/Pagination.jsx";
import usePaginatedList from "../hooks/usePaginatedList.js";
import { AppContent } from "../Context/AppContent.js";
import { canManagePrayers } from "../../../shared/pageAccess.mjs";
import axios from "../utils/axios";
import { toast } from "react-toastify";

export default function Prayer() {
  const { backendUrl, userData } = useContext(AppContent);
  const canManage = canManagePrayers(userData?.role);
  const [deletingId, setDeletingId] = useState(null);
  const deletingRef = useRef(null);
  const { items: prayers, loading, pagination, setPage, setFilters, refresh, filters: { search } } = usePaginatedList({
    url: `${backendUrl}/api/prayers`, dataKey: "prayers", initialFilters: { search: "" }, debounce: 300,
  });
  const deletePrayer = async (prayer) => {
    if (!canManage || deletingRef.current) return;
    if (!window.confirm(`Delete prayer “${prayer.title}”? This cannot be undone.`)) return;
    deletingRef.current = prayer._id;
    setDeletingId(prayer._id);
    try {
      const { data } = await axios.delete(`${backendUrl}/api/prayers/${prayer._id}`);
      if (!data.success) throw new Error(data.message || "Unable to delete prayer");
      toast.success(data.message || "Prayer deleted");
      refresh();
    } catch (error) { toast.error(error.response?.data?.message || error.message); }
    finally { deletingRef.current = null; setDeletingId(null); }
  };
  return (
    <div className="relative min-h-screen bg-transparent text-gray-900">
      <Navbar />
      <main className="px-4 pb-12 pt-40 sm:px-8 lg:px-16 lg:pb-28">
        <div className="mx-auto max-w-6xl rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-lg backdrop-blur-md sm:p-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">Prayer</h1>
              <p className="mt-2 text-gray-600">Read and present prayers together, one slide at a time.</p>
            </div>
            {canManage && <Link to="/prayer/new" className="rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800">Add prayer</Link>}
          </div>
          <label htmlFor="prayer-search" className="mb-2 block text-sm font-medium text-gray-700">Search prayers</label>
          <input id="prayer-search" type="search" value={search} onChange={(event) => setFilters({ search: event.target.value })}
            placeholder="Search by title..." maxLength={200}
            className="mb-8 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900" />
          {loading ? <p role="status" className="py-12 text-center text-gray-600">Loading prayers...</p> : prayers.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <p className="font-semibold">{search ? "No prayers match your search." : "No prayers have been added yet."}</p>
              {canManage && !search && <Link to="/prayer/new" className="mt-3 inline-block font-medium text-indigo-700">Add the first prayer</Link>}
            </div>
          ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {prayers.map((prayer) => (
              <article key={prayer._id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <BookOpen aria-hidden="true" className="mb-4 h-7 w-7 text-amber-600" />
                <h2 className="mb-6 break-words text-xl font-semibold">{prayer.title}</h2>
                <div className="mt-auto flex flex-wrap gap-3">
                  <Link to={`/prayer/${prayer._id}`} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">View prayer</Link>
                  {canManage && <Link to={`/prayer/${prayer._id}/edit`} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</Link>}
                  {canManage && <button type="button" onClick={() => deletePrayer(prayer)} disabled={deletingId !== null}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                    {deletingId === prayer._id ? "Deleting..." : "Delete prayer"}
                  </button>}
                </div>
              </article>
            ))}
          </div>}
          <Pagination pagination={pagination} onPageChange={setPage} loading={loading} />
        </div>
      </main>
    </div>
  );
}
