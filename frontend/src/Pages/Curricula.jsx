import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ChevronRight, GitBranch, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import Navbar from "../Components/Navbar.jsx";

import CurriculumTree from "../Components/CurriculumTree.jsx";
import CurriculumEditor from "../Components/CurriculumEditor.jsx";

export default function Curricula() {
  const { backendUrl, userData } = useContext(AppContent);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [curriculum, setCurricula] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [editor, setEditor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const roles = Array.isArray(userData?.role) ? userData.role : [userData?.role];
  const canManage = roles.some((role) => ["pascal", "admin", "leader", "pamela"].includes(role));
  const selectedId = params.get("curriculum");
  const selected = curriculum.find((curriculum) => curriculum._id === selectedId) || (!selectedId ? curriculum[0] : null);
  const filtered = curriculum.filter((curriculum) => curriculum.name.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${backendUrl}/api/curriculum`, { signal: controller.signal }).then(({ data }) => {
      if (!data.success) throw new Error(data.message || "Unable to load curriculum");
      setCurricula(data.curriculum || []);
      setError("");
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.response?.data?.message || failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [backendUrl, reload]);

  const onSaved = (curriculum) => {
    setCurricula((current) => [curriculum, ...current.filter((item) => item._id !== curriculum._id)]);
    setParams({ curriculum: curriculum._id });
    setEditor(null);
    toast.success("Curriculum saved");
  };

  const deleteCurriculum = async (curriculum) => {
    if (!canManage || deletingId || editor) return;
    if (!window.confirm(`Delete "${curriculum.name}"? Its lessons will be kept.`)) return;

    setDeletingId(curriculum._id);
    try {
      const { data } = await axios.delete(`${backendUrl}/api/curriculum/${curriculum._id}`);
      if (!data.success) throw new Error(data.message || "Unable to delete curriculum");
      const remaining = curriculum.filter((item) => item._id !== curriculum._id);
      setCurricula((current) => current.filter((item) => item._id !== curriculum._id));
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (!next.get("curriculum") || next.get("curriculum") === curriculum._id) {
          if (remaining.length) next.set("curriculum", remaining[0]._id);
          else next.delete("curriculum");
        }
        return next;
      }, { replace: true });
      toast.success(data.message || "Curriculum deleted");
    } catch (failure) {
      toast.error(failure.response?.data?.message || failure.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative isolate min-h-screen text-gray-900 bg-transparent">
      
      <Navbar />
      <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-40 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#a57922]">Saint George Church · The Way</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Curricula</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">Every lesson is a step forward. Follow the connections and explore your learning journey.</p>
          </div>
          {canManage && <button type="button" disabled={Boolean(deletingId)} onClick={() => setEditor({ curriculum: null })} className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"><Plus size={18} />Create curriculum</button>}
        </div>
        {canManage && editor && <CurriculumEditor key={editor.curriculum?._id || "new"} curriculum={editor.curriculum} backendUrl={backendUrl} onSaved={onSaved} onCancel={() => setEditor(null)} />}
        {loading ? (
          <div role="status" className="flex min-h-[400px] items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600" />Loading curriculum…</div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error}<button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }} className="ml-4 font-semibold underline">Try again</button></div>
        ) : curriculum.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8 text-center">
            <GitBranch size={40} className="mb-5 text-indigo-500" />
            <h2 className="text-xl font-semibold">A new learning journey starts here</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">{canManage ? "Create a curriculum, name its root, and connect your lessons into a tree." : "Your service team hasn’t added a curriculum yet. Check back soon to explore your lessons."}</p>
            {canManage && <button type="button" onClick={() => setEditor({ curriculum: null })} className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500">Create your first curriculum</button>}
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-gray-200 bg-transparent p-4 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold">Your learning paths</h2>
              <label className="relative mb-4 block"><span className="sr-only">Search curriculum</span><Search size={16} className="absolute left-3 top-3.5 text-gray-400" /><input className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" placeholder="Find a curriculum" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <div className="max-h-[420px] space-y-2 overflow-y-auto">
                {filtered.map((curriculum) => <button type="button" key={curriculum._id} aria-current={selected?._id === curriculum._id ? "true" : undefined}
                  onClick={() => { setParams({ curriculum: curriculum._id }); setEditor(null); }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected?._id === curriculum._id ? "border-indigo-200 bg-indigo-50 text-indigo-900" : "border-transparent hover:bg-gray-50"}`}>
                  <GitBranch size={20} className="shrink-0 text-indigo-500" />
                  <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold" dir="auto">{curriculum.name}</span><span className="mt-1 block text-xs text-gray-500">{curriculum.nodes.length} lessons</span></span><ChevronRight size={16} className="shrink-0 text-gray-400" />
                </button>)}
                {!filtered.length && <p className="py-4 text-sm text-gray-500">No curriculum match your search.</p>}
              </div>
              <div className="mt-5 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 p-4"><p className="text-sm font-medium text-indigo-900">Grow in knowledge, one lesson at a time.</p><p className="mt-2 text-xs leading-5 text-gray-500">The root is your starting point. Follow each branch to discover what comes next.</p></div>
            </aside>
            <section className="min-w-0" aria-label="Selected curriculum">
              {selected ? <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0"><h2 className="break-words text-xl font-semibold sm:text-2xl" dir="auto">{selected.name}</h2><p className="mt-1 text-sm text-gray-500">Explore the lesson tree</p></div>
                  {canManage && <div className="flex shrink-0 items-center gap-2">
                    <button type="button" disabled={Boolean(deletingId)} onClick={() => setEditor({ curriculum: selected })} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"><Pencil size={15} />Edit</button>
                    <button type="button" disabled={Boolean(deletingId) || Boolean(editor)} onClick={() => deleteCurriculum(selected)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} />{deletingId === selected._id ? "Deleting…" : "Delete"}</button>
                  </div>}
                </div>
                <CurriculumTree key={`${selected._id}-${selected.updatedAt}`} curriculum={selected} />
                {selected.nodes.length === 0 && <p className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">{canManage ? "Your root is ready. Use Edit to connect the first lesson." : "Lessons will appear here when your service team adds them."}</p>}
                {selected.nodes.length > 0 && <details className="mt-4 rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-gray-600">View lessons as a list</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.nodes.map((node) => <button type="button" key={node.id} disabled={!node.lesson?._id} onClick={() => navigate(`/lessons/${node.lesson._id}`, { state: { lesson: node.lesson } })} className="flex items-center gap-2 rounded-lg p-2 text-left text-sm text-indigo-700 hover:bg-indigo-50 disabled:text-gray-400"><BookOpen size={16} className="shrink-0" /><span dir="auto">{node.lesson?.title || "Unavailable lesson"}</span></button>)}</div></details>}
              </> : <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">This curriculum is unavailable. Choose another learning path.</div>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
