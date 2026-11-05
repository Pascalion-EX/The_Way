import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../utils/axios";
import ImageUpload from "./ImageUpload.jsx";
import LessonImportUploader from "./LessonImportUploader.jsx";

const LessonVariants = ({ lesson, variants, canManageLessons, backendUrl }) => {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState(lesson.image || "");
  const [imageUploading, setImageUploading] = useState(false);
  const [documentImporting, setDocumentImporting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [uploadSession, setUploadSession] = useState(0);
  const busy = creating || imageUploading || documentImporting;

  const handleSelect = (event) => {
    if (event.target.value === "create") {
      setName("");
      setError("");
      setImage(lesson.image || "");
      setDraft(null);
      setUploadSession((current) => current + 1);
      dialogRef.current.showModal();
    } else if (event.target.value !== lesson._id) {
      navigate(`/lessons/${event.target.value}`);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (submittingRef.current || imageUploading || documentImporting) return;
    if (!name.trim()) {
      setError("Enter a name for this variant.");
      return;
    }
    if (!image) {
      setError("Upload an image for this variant.");
      return;
    }
    if (draft && (!draft.title.trim() || draft.partitions.some((partition) => !partition.title.trim() || !partition.body.trim()))) {
      setError("The imported title and every partition must have content.");
      return;
    }

    submittingRef.current = true;
    setCreating(true);
    setError("");
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/lessons/${lesson._id}/variants`,
        { name: name.trim(), ...(draft ? { draft } : {}), ...(image !== lesson.image ? { image } : {}) }
      );
      if (!data.success || !data.lesson) {
        throw new Error(data.message || "Unable to create lesson variant");
      }
      dialogRef.current.close();
      toast.success("Lesson variant created");
      navigate(`/lessons/${data.lesson._id}`);
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    } finally {
      submittingRef.current = false;
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageLessons || !lesson.variantGroup || submittingRef.current) return;
    if (!window.confirm(`Delete variant “${lesson.name}”? The original lesson and other variants will be kept.`)) return;

    submittingRef.current = true;
    setDeleting(true);
    try {
      const { data } = await axios.delete(`${backendUrl}/api/lessons/${lesson._id}`);
      if (!data.success) {
        throw new Error(data.message || "Unable to delete variant");
      }
      const nextLesson = variants.find((variant) => variant._id === lesson.variantGroup)
        || variants.find((variant) => variant._id !== lesson._id);
      toast.success("Variant deleted");
      navigate(nextLesson ? `/lessons/${nextLesson._id}` : "/lessons", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      submittingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <>
      <select
        aria-label="Lesson variants"
        value={lesson._id}
        onChange={handleSelect}
        disabled={busy || deleting}
        className="h-[42px] w-full cursor-pointer truncate rounded-full border border-gray-400 bg-white py-2 pl-4 pr-8 text-sm font-medium text-gray-700 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-56"
      >
        <optgroup label="Choose variant">
          {variants.map((variant) => (
            <option key={variant._id} value={variant._id}>
              {variant.variantGroup ? variant.name : `Original · ${variant.name}`}
            </option>
          ))}
        </optgroup>
        {canManageLessons && <option value="create">+ Create variant</option>}
      </select>

      {canManageLessons && lesson.variantGroup && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy || deleting}
          className="w-full cursor-pointer rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {deleting ? "Deleting..." : "Delete variant"}
        </button>
      )}

      {canManageLessons && (
        <dialog
          ref={dialogRef}
          aria-labelledby="create-variant-title"
          aria-describedby="create-variant-description"
          onCancel={(event) => { if (submittingRef.current || imageUploading || documentImporting) event.preventDefault(); }}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/40"
        >
          <form onSubmit={handleCreate}>
            <h2 id="create-variant-title" className="text-xl font-semibold">Create variant</h2>
            <p id="create-variant-description" className="mt-2 text-sm leading-6 text-gray-600">
              Create a copy of “{lesson.name}”. Upload a document to use different content and choose an image for the variant.
            </p>
            <label htmlFor="variant-name" className="mt-5 block text-sm font-medium">Variant name</label>
            <input
              id="variant-name"
              autoFocus
              required
              maxLength={120}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "variant-error" : undefined}
              placeholder="e.g. Younger group"
              className="mt-2 h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
            <div key={uploadSession} className="mt-5 space-y-5">
              <LessonImportUploader
                disabled={creating || imageUploading}
                hasExistingContent={Boolean(draft)}
                onImportingChange={setDocumentImporting}
                onImported={setDraft}
                completionHint="Review the title and partitions below, then create the variant."
              />
              {draft ? (
                <section className="space-y-4 rounded-xl border border-gray-200 p-4" aria-label="Imported variant content">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Imported content</h3>
                    <button type="button" disabled={busy} onClick={() => setDraft(null)} className="text-sm font-medium text-indigo-700">Use original content</button>
                  </div>
                  <label className="block text-sm font-medium">
                    Lesson title
                    <input required value={draft.title} disabled={busy} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      className="mt-2 h-12 w-full rounded-xl border border-gray-300 px-4 font-normal" />
                  </label>
                  {draft.partitions.map((partition, index) => (
                    <div key={index} className="space-y-2">
                      <label className="block text-sm font-medium">
                        Partition {index + 1} title
                        <input required value={partition.title} disabled={busy}
                          onChange={(event) => setDraft((current) => ({ ...current, partitions: current.partitions.map((part, position) => position === index ? { ...part, title: event.target.value } : part) }))}
                          className="mt-2 h-11 w-full rounded-xl border border-gray-300 px-4 font-normal" />
                      </label>
                      <label className="block text-sm font-medium">
                        Partition {index + 1} content
                        <textarea required rows={5} value={partition.body} disabled={busy}
                          onChange={(event) => setDraft((current) => ({ ...current, partitions: current.partitions.map((part, position) => position === index ? { ...part, body: event.target.value } : part) }))}
                          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal" />
                      </label>
                    </div>
                  ))}
                </section>
              ) : <p className="text-sm text-gray-500">The variant will use the current lesson content until you import a document.</p>}
              <ImageUpload label="Variant image" value={image} onChange={setImage} onUploadingChange={setImageUploading} required disabled={busy} />
              <p className="text-xs text-gray-500">The current image is used unless you upload a replacement. The year, video, and activity are copied from this lesson.</p>
            </div>
            {error && <p id="variant-error" role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={() => dialogRef.current.close()} className="rounded-full border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-full bg-black px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50">{creating ? "Creating..." : "Create variant"}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
};

export default LessonVariants;
