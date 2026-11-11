import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../Components/Navbar.jsx";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios.js";

export default function YearOneToThreeActivities() {
  const { backendUrl } = useContext(AppContent);
  const [month, setMonth] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [requestState, setRequestState] = useState({ key: null, error: "" });
  const [revision, setRevision] = useState(0);
  const url = `${backendUrl}/api/activities/year-1-3/schedule`;
  const requestKey = JSON.stringify([url, month, revision]);
  const loading = requestState.key !== requestKey;
  const error = loading ? "" : requestState.error;
  const accessDenied = [401, 403].includes(requestState.status);
  const visibleSchedule = schedule && (month === null || schedule.month === month) ? schedule : null;

  useEffect(() => {
    const controller = new AbortController();
    axios.get(url, { params: month ? { month } : {}, signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!data.success) throw new Error(data.message || "Unable to load the schedule");
        setSchedule(data);
        setRequestState({ key: requestKey, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          if ([401, 403].includes(failure.response?.status)) setSchedule(null);
          setRequestState({ key: requestKey, error: failure.response?.data?.message || failure.message, status: failure.response?.status });
        }
      });
    return () => controller.abort();
  }, [url, month, requestKey]);

  useEffect(() => {
    if (accessDenied) return;
    // Ask the server for the current month again when it rolls over or the tab returns.
    const refresh = () => { if (!document.hidden) setRevision((value) => value + 1); };
    const timer = month === null ? setInterval(refresh, 60_000) : null;
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [month, accessDenied]);

  const saveActivity = async (date, activity) => {
    let data;
    try {
      ({ data } = await axios.put(`${url}/${date}`, { activity }));
    } catch (failure) {
      if ([401, 403].includes(failure.response?.status)) {
        setSchedule(null);
        setRequestState({ key: requestKey, error: failure.response.data.message || "Access denied", status: failure.response.status });
      }
      throw failure;
    }
    if (!data.success) throw new Error(data.message || "Unable to save the activity");
    setSchedule((previous) => previous ? {
      ...previous,
      entries: previous.entries.map((entry) => entry.date === date ? { ...entry, ...data.entry } : entry),
    } : previous);
    toast.success("Activity saved");
  };

  const buttonClass = "min-h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="relative min-h-screen bg-transparent text-gray-900">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-40 sm:px-8">
        <Link to="/activities" className="mb-6 inline-block text- font-semibold text-indigo-600 hover:underline">← All activities</Link>
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="year-1-3-title">
          <h1 id="year-1-3-title" className="text-3xl font-bold tracking-tight">Year 1–3 Post Lesson Activities</h1>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <label className="text-sm font-medium text-gray-700">
              Month
              <input type="month" min="1900-01" max="9999-12" value={month || schedule?.month || ""}
                onChange={(event) => { if (event.target.value) setMonth(event.target.value); }}
                className="mt-2 block min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={loading || !visibleSchedule?.previousMonth}
                onClick={() => setMonth(visibleSchedule.previousMonth)}>Previous month</button>
              <button type="button" className={buttonClass} onClick={() => { setMonth(null); setRevision((value) => value + 1); }}>This month</button>
              <button type="button" className={buttonClass} disabled={loading || !visibleSchedule?.nextMonth}
                onClick={() => setMonth(visibleSchedule.nextMonth)}>Next month</button>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
              <button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-3 font-semibold underline">Retry</button>
            </div>
          )}
          {loading && <p role="status" className="mt-5 text-sm text-gray-500">Loading schedule…</p>}

          {visibleSchedule && (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200" aria-busy={loading}>
              <table className="w-full border-collapse text-left">
                <caption className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-left text-3xl font-semibold">{visibleSchedule.monthLabel}</caption>
                <thead className="border-b border-gray-200 bg-gray-50 text-sm text-gray-600">
                  <tr>
                    <th scope="col" className="w-40 px-4 py-4 font-semibold sm:w-56 sm:px-5">Date</th>
                    <th scope="col" className="px-4 py-4 font-semibold sm:px-5">Day activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleSchedule.entries.map((entry) => (
                    <ActivityRow key={entry.date} entry={entry} canEdit={visibleSchedule.canEdit} onSave={saveActivity} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ActivityRow({ entry, canEdit, onSave }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const activity = draft ?? entry.activity;
  const changed = activity !== entry.activity;

  const save = async (event) => {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    try {
      await onSave(entry.date, activity);
      setDraft(null);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <th scope="row" className="px-4 py-5 align-top text-3xl font-3xl text-gray-800 sm:px-5">
        <time dateTime={entry.date}>{entry.dateLabel}</time>
      </th>
      <td className="px-4 py-5 sm:px-5">
        {canEdit ? (
          <form onSubmit={save}>
            <textarea aria-label={`Activity for ${entry.dateLabel}`} value={activity} onChange={(event) => setDraft(event.target.value)}
              maxLength={2000} rows={3} disabled={saving} placeholder="Add the day's activity…"
              className="block w-full min-w-40 resize-y rounded-xl border border-gray-300 bg-white px-3 py-3 text-4xl leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={saving || !changed} className="min-h-10 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Saving…" : "Save activity"}
              </button>
              {changed && <button type="button" disabled={saving} onClick={() => setDraft(null)} className="min-h-10 px-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50">Reset</button>}
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap break-words text-lg leading-8 text-gray-700">{entry.activity || "No activity planned yet."}</p>
        )}
      </td>
    </tr>
  );
}
