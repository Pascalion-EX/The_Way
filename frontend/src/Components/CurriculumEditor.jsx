import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import axios from "../utils/axios";

const field = "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500";

export default function CurriculumEditor({ curriculum, backendUrl, onSaved, onCancel }) {
  const [name, setName] = useState(curriculum?.name || "");
  const [nodes, setNodes] = useState(() => (curriculum?.nodes || []).map((node) => ({
    id: node.id, lesson: node.lesson?._id || "", parentId: node.parentId,
  })));
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${backendUrl}/api/lessons`, { signal: controller.signal }).then(({ data }) => {
      if (!data.success) throw new Error(data.message || "Unable to load lessons");
      setLessons(data.lessons || []);
      setError("");
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.response?.data?.message || failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [backendUrl, reload]);

  const descendants = (id) => {
    const ids = new Set([id]);
    let previousSize;
    do {
      previousSize = ids.size;
      for (const node of nodes) if (ids.has(node.parentId)) ids.add(node.id);
    } while (previousSize !== ids.size);
    return ids;
  };
  const updateNode = (id, changes) => setNodes((current) => current.map((node) => node.id === id ? { ...node, ...changes } : node));
  const lessonTitle = (node) => lessons.find((lesson) => lesson._id === node.lesson)?.title || "Choose a lesson";

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const body = { name: name.trim(), nodes };
      const { data } = curriculum
        ? await axios.put(`${backendUrl}/api/curriculum/${curriculum._id}`, body)
        : await axios.post(`${backendUrl}/api/curriculum`, body);
      if (!data.success) throw new Error(data.message || "Unable to save curriculum");
      onSaved(data.curriculum);
    } catch (failure) {
      setError(failure.response?.data?.message || failure.message);
    } finally { setSaving(false); }
  };

  return (
    <section className="mb-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="curriculum-editor-title">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="curriculum-editor-title" className="text-xl font-semibold">{curriculum ? "Edit curriculum" : "Create curriculum"}</h2>
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Close curriculum editor"><X size={20} /></button>
      </div>
      <form onSubmit={save}>
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          <label className="block text-sm font-medium">Curriculum name
            <input autoFocus className={`${field} mt-2`} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. First Year Curriculum" required />
          </label>
          <p className="text-sm leading-6 text-gray-500">The name becomes the root. Add lessons and choose what each lesson connects to.</p>
          {loading ? <p role="status" className="text-sm text-gray-500">Loading lessons…</p> : lessons.length === 0 ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No lessons available. You can save a named root now and add lessons later.
              <button type="button" className="ml-2 underline" onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Retry lessons</button>
            </div>
          ) : null}
          <div className="space-y-3">
            {nodes.map((node, index) => {
              const excludedParents = descendants(node.id);
              return (
                <div key={node.id} className="grid items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="min-w-0 text-xs font-medium text-gray-600">Lesson {index + 1}
                    <select className={`${field} mt-1`} value={node.lesson} onChange={(event) => updateNode(node.id, { lesson: event.target.value })} required>
                      <option value="">Choose a lesson</option>
                      {lessons.map((lesson) => <option key={lesson._id} value={lesson._id}>{lesson.title} · Year {lesson.year}</option>)}
                    </select>
                  </label>
                  <label className="min-w-0 text-xs font-medium text-gray-600">Connect to
                    <select className={`${field} mt-1`} value={node.parentId} onChange={(event) => updateNode(node.id, { parentId: event.target.value })}>
                      <option value="root">{name.trim() || "Curriculum root"} (root)</option>
                      {nodes.filter((parent) => !excludedParents.has(parent.id)).map((parent) => <option key={parent.id} value={parent.id}>{lessonTitle(parent)}</option>)}
                    </select>
                  </label>
                  <button type="button" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-3 text-red-600 hover:bg-red-50" aria-label={`Remove lesson ${index + 1} and its branch`} title="Remove this lesson and its descendants"
                    onClick={() => setNodes((current) => current.filter((item) => !excludedParents.has(item.id)))}><Trash2 size={16} /><span className="sm:hidden">Remove branch</span></button>
                </div>
              );
            })}
          </div>
          <button type="button" disabled={loading || !lessons.length} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setNodes((current) => [...current, { id: crypto.randomUUID(), lesson: "", parentId: "root" }])}><Plus size={16} />Add lesson</button>
          {nodes.length > 0 && <p className="text-xs text-gray-500">Removing a lesson also removes its connected descendants from this curriculum.</p>}
        </fieldset>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || loading} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? "Saving…" : "Save curriculum"}</button>
        </div>
      </form>
    </section>
  );
}
