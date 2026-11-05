import { useContext, useId, useState } from "react";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios";
import ContentImage from "./ContentImage.jsx";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUpload({ value, onChange, onUploadingChange, required = false, disabled = false, label = "Image" }) {
  const { backendUrl } = useContext(AppContent);
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const selectImage = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES || !file.size) {
      setError("Choose a JPEG, PNG, or WebP image, 5 MB or smaller.");
      input.value = "";
      return;
    }

    setUploading(true);
    setProgress(0);
    onUploadingChange(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/uploads/images`, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: ({ loaded, total }) => setProgress(total ? Math.min(100, Math.round(100 * loaded / total)) : 0),
      });
      if (!data.success) throw new Error(data.message || "Unable to upload the image.");
      onChange(data.url);
    } catch (uploadError) {
      setError(uploadError.response?.data?.message || uploadError.message || "Unable to upload the image. Please try again.");
    } finally {
      input.value = "";
      setUploading(false);
      onUploadingChange(false);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required ? "(required)" : "(optional)"}
      </label>
      <input
        id={id}
        type="file"
        accept={TYPES.join(",")}
        required={required && !value}
        disabled={disabled || uploading}
        onChange={selectImage}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(error)}
        className="block w-full rounded-xl border border-gray-300 bg-white p-2 text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-medium file:text-indigo-700 disabled:opacity-60"
      />
      <p id={`${id}-hint`} className="text-xs text-gray-500">JPEG, PNG, or WebP. Up to 5 MB.</p>
      {uploading && <p role="status" className="text-sm text-indigo-700">{progress < 100 ? `Uploading image… ${progress}%` : "Preparing image…"}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{error}</p>}
      {value && (
        <div className="space-y-2">
          <ContentImage src={value} alt={`${label} preview`} className="max-h-48 max-w-full rounded-xl border border-gray-200 object-contain" />
          {!required && <button type="button" disabled={disabled || uploading} onClick={() => { onChange(""); setError(""); }} className="text-sm font-medium text-red-600 disabled:opacity-60">Remove image</button>}
        </div>
      )}
    </div>
  );
}
