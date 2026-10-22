import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "../utils/axios";

const LessonVariants = ({ lesson, variants, canManageLessons, backendUrl }) => {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = (event) => {
    if (event.target.value === "create") {
      setName("");
      setError("");
      dialogRef.current.showModal();
    } else if (event.target.value !== lesson._id) {
      navigate(`/lessons/${event.target.value}`);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!name.trim()) {
      setError("Enter a name for this variant.");
      return;
    }

    submittingRef.current = true;
    setCreating(true);
    setError("");
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/lessons/${lesson._id}/variants`,
        { name: name.trim() }
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
        disabled={creating || deleting}
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
          disabled={creating || deleting}
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
          onCancel={(event) => { if (submittingRef.current) event.preventDefault(); }}
          className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/40"
        >
          <form onSubmit={handleCreate}>
            <h2 id="create-variant-title" className="text-xl font-semibold">Create variant</h2>
            <p id="create-variant-description" className="mt-2 text-sm leading-6 text-gray-600">
              Copy “{lesson.name}” with a new name. You can edit the copy independently.
            </p>
            <label htmlFor="variant-name" className="mt-5 block text-sm font-medium">Variant name</label>
            <input
              id="variant-name"
              autoFocus
              required
              maxLength={120}
              value={name}
              disabled={creating}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "variant-error" : undefined}
              placeholder="e.g. Younger group"
              className="mt-2 h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
            {error && <p id="variant-error" role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={creating} onClick={() => dialogRef.current.close()} className="rounded-full border border-gray-300 px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={creating} className="rounded-full bg-black px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50">{creating ? "Creating..." : "Create variant"}</button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
};

export default LessonVariants;
