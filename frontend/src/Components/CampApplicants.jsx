import { useContext, useEffect, useState } from "react";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios";

function PaymentScreenshotImage({ source }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    axios.get(source, { responseType: "blob", signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Unable to load payment screenshot. Close and reopen to retry.");
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source]);
  if (error) return <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>;
  if (!url) return <p role="status" className="mt-2 text-sm text-gray-500">Loading screenshot...</p>;
  return (
    <div className="mt-3 space-y-2">
      <img src={url} alt="Submitted payment screenshot" className="max-h-96 max-w-full rounded-xl border border-gray-200 object-contain" />
      <a href={url} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-indigo-700">Open screenshot full size</a>
    </div>
  );
}

function PaymentScreenshot({ path }) {
  const { backendUrl } = useContext(AppContent);
  const [open, setOpen] = useState(false);
  const source = `${backendUrl}${path}`;
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm font-semibold text-indigo-700">
        {open ? "Hide payment screenshot" : "View payment screenshot"}
      </button>
      {open && <PaymentScreenshotImage key={source} source={source} />}
    </div>
  );
}

export default function CampApplicants({ campId }) {
  const { backendUrl } = useContext(AppContent);
  const [applicants, setApplicants] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadApplicants = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${backendUrl}/api/camps/${campId}/applicants`);
      if (!data.success) throw new Error(data.message || "Unable to load applicants");
      setApplicants(data.applicants);
    } catch (error) { setError(error.response?.data?.message || error.message); }
    finally { setLoading(false); }
  };
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 p-4 sm:p-5" aria-label="Applicants and payments">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Applicants and payments</h2>
        <button type="button" disabled={loading} onClick={loadApplicants} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">
          {loading ? "Loading..." : applicants ? "Refresh applicants" : "Load applicants"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {applicants && <p className="mt-3 text-sm text-gray-500">{applicants.length} applicant(s)</p>}
      {applicants?.length === 0 && <p className="mt-3 text-sm text-gray-500">No applications yet.</p>}
      <div className="mt-4 space-y-4">
        {applicants?.map((applicant) => (
          <article key={applicant._id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="break-words font-semibold text-gray-900">{applicant.childName || applicant.servantName || applicant.user?.name || "Applicant"}</h3>
            {applicant.childYear && <p className="mt-1 text-sm text-gray-600">Year {applicant.childYear}</p>}
            {applicant.servantRole && <p className="mt-1 text-sm text-gray-600">{applicant.servantRole}</p>}
            <p className="mt-1 break-words text-sm text-gray-600">{applicant.user?.name || "Deleted account"}{applicant.user?.email ? ` · ${applicant.user.email}` : ""}</p>
            {applicant.parentPhone && <p className="mt-1 text-sm text-gray-600">Phone: {applicant.parentPhone}</p>}
            {applicant.appliedAt && <p className="mt-1 text-xs text-gray-500">Applied {new Date(applicant.appliedAt).toLocaleDateString("en-GB")}</p>}
            {applicant.notes && <p className="mt-2 whitespace-pre-line break-words text-sm text-gray-600">{applicant.notes}</p>}
            {applicant.paymentScreenshotUrl ? <PaymentScreenshot path={applicant.paymentScreenshotUrl} /> : <p className="mt-3 text-sm text-gray-500">No payment screenshot attached.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
