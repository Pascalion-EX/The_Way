import { useContext, useEffect, useRef, useState } from "react";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios.js";
import { LESSON_DOCUMENT_ACCEPT, lessonDocumentFileError } from "../../../shared/lessonImport.mjs";

const LessonImportUploader = ({ onImported, onImportingChange, disabled = false, hasExistingContent = false }) => {
  const { backendUrl } = useContext(AppContent);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const importDocument = async () => {
    if (disabled || importing || requestRef.current) return;
    const fileError = lessonDocumentFileError(file);
    if (fileError) { setError(fileError); return; }
    setError("");
    setResult(null);
    setImporting(true);
    onImportingChange?.(true);
    const request = new AbortController();
    requestRef.current = request;
    try {
      const body = new FormData();
      body.append("document", file);
      const { data } = await axios.post(`${backendUrl}/api/lessons/import`, body, { signal: request.signal });
      if (request.signal.aborted) return;
      const draft = data.draft;
      if (!data.success || typeof draft?.title !== "string" || !Array.isArray(draft.partitions) || !draft.partitions.length ||
          !draft.partitions.every((partition) => typeof partition?.title === "string" && typeof partition?.body === "string")) {
        throw new Error(data.message || "The document did not return a usable lesson draft.");
      }
      onImported(draft);
      setResult({ count: draft.partitions.length, warnings: (data.warnings || []).filter((message) => typeof message === "string") });
    } catch (failure) {
      if (!request.signal.aborted) setError(failure.response?.data?.message || failure.message || "Unable to import this document.");
    } finally {
      requestRef.current = null;
      setImporting(false);
      onImportingChange?.(false);
    }
  };

  return (
    <section aria-labelledby="lesson-import-heading" aria-busy={importing} className="mb-8 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-6">
      <h2 id="lesson-import-heading" className="text-xl font-semibold text-gray-900">Import a lesson document</h2>
      <p id="lesson-import-help" className="mt-2 text-sm leading-6 text-gray-600">
        Word (.docx), PDF, HTML, or TXT · Up to 10 MB. Headings become editable partitions.
        Documents without headings use one partition. Scanned PDFs need OCR first.
      </p>
      <label htmlFor="lesson-document" className="mt-4 block text-sm font-medium text-gray-700">Lesson document</label>
      <input
        id="lesson-document"
        type="file"
        accept={LESSON_DOCUMENT_ACCEPT}
        aria-describedby="lesson-import-help"
        disabled={disabled || importing}
        onChange={(event) => {
          const selected = event.target.files?.[0] || null;
          setFile(selected);
          setResult(null);
          setError(selected ? lessonDocumentFileError(selected) || "" : "");
        }}
        className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-medium disabled:opacity-50"
      />
      {hasExistingContent && <p className="mt-3 text-sm text-amber-800">Importing will replace the current lesson title and partitions.</p>}
      <button
        type="button"
        disabled={disabled || importing || !file || Boolean(lessonDocumentFileError(file))}
        onClick={importDocument}
        className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {importing ? "Importing document…" : hasExistingContent ? "Import and replace title & partitions" : "Import document"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {result && (
        <div role="status" className="mt-3 space-y-1 text-sm text-gray-700">
          <p>Imported {result.count} {result.count === 1 ? "partition" : "partitions"}. Review the content below, then add the image, name, and year before saving.</p>
          {result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
        </div>
      )}
    </section>
  );
};

export default LessonImportUploader;
