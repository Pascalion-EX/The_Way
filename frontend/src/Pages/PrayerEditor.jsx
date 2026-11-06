import { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../Components/Navbar.jsx";
import { AppContent } from "../Context/AppContent.js";
import { canManagePrayers } from "../../../shared/pageAccess.mjs";
import axios from "../utils/axios";
import ImageUpload from "../Components/ImageUpload.jsx";
import { PRAYER_LANGUAGES, getPrayerSlides } from "../../../shared/prayerSlides.mjs";

const newSlide = (slide = {}) => ({ id: crypto.randomUUID(), text: slide.text || "", image: slide.image || "" });
const editablePrayer = (prayer = {}) => ({
  title: prayer.title || "",
  slides: Object.fromEntries(PRAYER_LANGUAGES.map((language) => {
    const slides = getPrayerSlides(prayer, language);
    return [language, slides.length ? slides.map(newSlide) : [newSlide()]];
  })),
});

export default function PrayerEditor() {
  const { id } = useParams();
  const { userData } = useContext(AppContent);
  return (
    <div className="relative min-h-screen bg-transparent text-gray-900">
      <Navbar />
      <main className="px-4 pb-12 pt-40 sm:px-8 lg:px-16 lg:pb-28">
        <div className="mx-auto max-w-4xl rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-lg backdrop-blur-md sm:p-8">
          {canManagePrayers(userData?.role) ? <PrayerEditorForm key={id || "new"} id={id} /> : (
            <><h1 className="text-3xl font-bold">Prayer</h1>
              <p role="alert" className="mt-4 text-gray-600">Only admin, Pascal, and Pamela users can add or edit prayers.</p>
              <Link to="/prayer" className="mt-5 inline-block font-medium text-indigo-700">Back to Prayer</Link></>
          )}
        </div>
      </main>
    </div>
  );
}

function PrayerEditorForm({ id }) {
  const { backendUrl } = useContext(AppContent);
  const navigate = useNavigate();
  const [form, setForm] = useState(() => id ? null : editablePrayer());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [uploadingIds, setUploadingIds] = useState([]);
  const uploadingRef = useRef(new Set());
  const busy = saving || uploadingIds.length > 0;

  const trackUpload = (slideId, uploading) => {
    if (uploading) uploadingRef.current.add(slideId);
    else uploadingRef.current.delete(slideId);
    setUploadingIds([...uploadingRef.current]);
  };
  const updateSlide = (language, slideId, changes) => setForm((current) => ({
    ...current, slides: { ...current.slides, [language]: current.slides[language].map((slide) => slide.id === slideId ? { ...slide, ...changes } : slide) },
  }));
  const moveSlide = (language, index, offset) => setForm((current) => {
    const slides = [...current.slides[language]];
    [slides[index], slides[index + offset]] = [slides[index + offset], slides[index]];
    return { ...current, slides: { ...current.slides, [language]: slides } };
  });

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    axios.get(`${backendUrl}/api/prayers/${id}`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!data.success || !data.prayer) throw new Error(data.message || "Unable to load prayer");
      setForm(editablePrayer(data.prayer));
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.response?.data?.message || failure.message);
    });
    return () => controller.abort();
  }, [backendUrl, id]);

  const save = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (uploadingRef.current.size) {
      setError("Please wait for slide images to finish uploading.");
      return;
    }
    const payload = { title: form.title.trim(), slides: Object.fromEntries(PRAYER_LANGUAGES.map((language) => [language,
      form.slides[language].map(({ text, image }) => ({ text: text.trim(), image })).filter((slide) => slide.text || slide.image),
    ])) };
    if (!payload.title || !Object.values(payload.slides).some((slides) => slides.length)) {
      setError("Add a title and at least one slide with text or an image.");
      return;
    }
    if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 80 * 1024) {
      setError("This prayer is too long. Use at most 80 KB of text.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const { data } = id ? await axios.put(`${backendUrl}/api/prayers/${id}`, payload) : await axios.post(`${backendUrl}/api/prayers`, payload);
      if (!data.success || !data.prayer) throw new Error(data.message || "Unable to save prayer");
      toast.success(data.message || "Prayer saved");
      navigate(`/prayer/${data.prayer._id}`);
    } catch (failure) { setError(failure.response?.data?.message || failure.message); }
    finally { submitting.current = false; setSaving(false); }
  };

  if (!form) return <>
    <Link to="/prayer" className="text-sm font-medium text-gray-600">← Back to Prayer</Link>
    {error ? <p role="alert" className="mt-5 text-red-600">{error}</p> : <p role="status" className="mt-5 text-gray-600">Loading prayer...</p>}
  </>;

  return (
    <>
      <Link to={id ? `/prayer/${id}` : "/prayer"} className="text-sm font-medium text-gray-600">← Back to Prayer</Link>
      <h1 className="mt-5 text-3xl font-bold sm:text-4xl">{id ? "Edit prayer" : "Add prayer"}</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-gray-600">Each card is one presentation slide. Add text, an image, or both, in one or more languages. Empty slides are skipped when saving.</p>
      <form onSubmit={save}>
        <fieldset disabled={busy} className="space-y-6">
          <label className="block font-semibold text-gray-700">
            Title
            <input required maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Prayer title" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-gray-900" />
          </label>
          {[['arabic', 'Arabic'], ['coptic', 'Coptic'], ['english', 'English']].map(([language, label]) => (
            <section key={language} aria-label={`${label} prayer slides`} className="space-y-4">
              <h2 className="text-xl font-semibold">{label} prayer text and slides</h2>
              {form.slides[language].map((slide, index) => (
                <div key={slide.id} className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">{label} slide {index + 1}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy || index === 0} onClick={() => moveSlide(language, index, -1)}
                        aria-label={`Move ${label} slide ${index + 1} up`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40">↑ Up</button>
                      <button type="button" disabled={busy || index === form.slides[language].length - 1} onClick={() => moveSlide(language, index, 1)}
                        aria-label={`Move ${label} slide ${index + 1} down`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40">↓ Down</button>
                      <button type="button" disabled={busy} onClick={() => setForm((current) => ({ ...current, slides: {
                        ...current.slides, [language]: current.slides[language].filter((entry) => entry.id !== slide.id),
                      } }))} aria-label={`Remove ${label} slide ${index + 1}`} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600 disabled:opacity-40">Remove slide</button>
                    </div>
                  </div>
                  <label className="block text-sm font-medium text-gray-700">
                    Slide text
                    <textarea value={slide.text} dir={language === "arabic" ? "rtl" : "ltr"} lang={language === "arabic" ? "ar" : language === "english" ? "en" : "cop"}
                      onChange={(event) => updateSlide(language, slide.id, { text: event.target.value })}
                      rows={5} className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 font-normal leading-7 outline-none focus:ring-2 focus:ring-gray-900" />
                  </label>
                  <ImageUpload label={`${label} slide ${index + 1} image`} value={slide.image}
                    onChange={(image) => updateSlide(language, slide.id, { image })}
                    onUploadingChange={(uploading) => trackUpload(slide.id, uploading)} disabled={busy} />
                </div>
              ))}
              <button type="button" disabled={busy} onClick={() => setForm((current) => ({ ...current, slides: {
                ...current.slides, [language]: [...current.slides[language], newSlide()],
              } }))} className="rounded-xl border border-dashed border-gray-400 px-4 py-3 text-sm font-medium text-gray-700 disabled:opacity-40">Add {label} slide</button>
            </section>
          ))}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-800 disabled:opacity-50">{saving ? "Saving..." : id ? "Save prayer" : "Add prayer"}</button>
            <button type="button" onClick={() => navigate(id ? `/prayer/${id}` : "/prayer")} className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
