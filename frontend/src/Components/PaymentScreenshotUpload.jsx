import { useEffect, useId, useState } from "react";

export default function PaymentScreenshotUpload({ value, onChange, disabled }) {
  const id = useId();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!value) { setPreview(""); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">Payment screenshot (required)</label>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" required={!value} disabled={disabled}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={Boolean(error)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
            setError("Choose a JPEG, PNG, or WebP screenshot, 5 MB or smaller.");
            event.target.value = "";
            onChange(null);
            return;
          }
          setError("");
          onChange(file);
        }}
        className="block w-full rounded-xl border border-gray-300 bg-white p-2 text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-indigo-700 disabled:opacity-60" />
      <p id={`${id}-hint`} className="text-xs text-gray-500">JPEG, PNG, or WebP. Up to 5 MB. Only staff can view your payment screenshot.</p>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{error}</p>}
      {preview && <img src={preview} alt="Your payment screenshot preview" className="max-h-64 max-w-full rounded-xl border border-gray-200 object-contain" />}
    </div>
  );
}
