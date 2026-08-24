import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import { assets } from "../assets/assets.js";
import Waves from "../Components/Waves.jsx";
import Navbar from "@/Components/Navbar.jsx";

const Camp = () => {
  const navigate = useNavigate();
  const { backendUrl, userData, isLoggedin } = useContext(AppContent);

  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [notifyCamp, setNotifyCamp] = useState(null);
  const [notifySubject, setNotifySubject] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyingCampId, setNotifyingCampId] = useState(null);

  const [applyingCampId, setApplyingCampId] = useState(null);
  const [deletingCampId, setDeletingCampId] = useState(null);
  const [withdrawingCampId, setWithdrawingCampId] = useState(null);

  const [selectedCamp, setSelectedCamp] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const [formData, setFormData] = useState({
    childName: "",
    childYear: "",
    parentPhone: "",
    leaderName: "",
    leaderRole: "",
    notes: "",
  });

  const createRoles = ["admin", "leader", "pascal"];
  const applyRoles = ["parent", "child", "admin", "leader", "pascal"];
  const leaderFormRoles = ["admin", "leader", "pascal"];
  const notifyRoles = ["admin", "leader", "pascal"];

  const userRoles = useMemo(() => {
    const roles = Array.isArray(userData?.role)
      ? userData.role
      : userData?.role
      ? [userData.role]
      : [];

    return roles.map((role) => String(role).toLowerCase().trim());
  }, [userData]);

  const canCreateCamp = userRoles.some((role) => createRoles.includes(role));
  const canApplyCamp = userRoles.some((role) => applyRoles.includes(role));
  const canNotifyCamp = userRoles.some((role) => notifyRoles.includes(role));

  const isParent = userRoles.includes("parent");
  const isChild = userRoles.includes("child");
  const isLeaderFormUser = userRoles.some((role) =>
    leaderFormRoles.includes(role)
  );

  const yearOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const getUserId = () => {
    return userData?._id || userData?.id || userData?.userId;
  };

  const hasApplied = (camp) => {
    const userId = getUserId();

    if (!userId || !Array.isArray(camp.applicants)) {
      return false;
    }

    return camp.applicants.some((applicant) => {
      const applicantUser = applicant.user;

      if (!applicantUser) return false;

      if (typeof applicantUser === "string") {
        return applicantUser === userId;
      }

      return applicantUser._id === userId || applicantUser.id === userId;
    });
  };

  const getApplicationType = () => {
    if (isLeaderFormUser) return "leader";
    if (isParent) return "parent_for_child";
    if (isChild) return "child_self";
    return "";
  };

  const resetApplyForm = () => {
    setFormData({
      childName: "",
      childYear: "",
      parentPhone: "",
      leaderName: "",
      leaderRole: "",
      notes: "",
    });
  };

  const fetchCamps = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(`${backendUrl}/api/camps`);

      if (data.success) {
        setCamps(data.camps || []);
      } else {
        toast.error(data.message || "Failed to load trips");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps();
  }, []);

  const filteredAndSortedCamps = useMemo(() => {
    let result = [...camps];

    if (search.trim()) {
      const q = search.trim().toLowerCase();

      result = result.filter((camp) => {
        const titleMatch = camp.title?.toLowerCase().includes(q);
        const nameMatch = camp.name?.toLowerCase().includes(q);
        const bodyMatch = camp.body?.toLowerCase().includes(q);
        const tripTypeMatch = camp.TripType?.toLowerCase().includes(q);

        const yearsMatch = Array.isArray(camp.years)
          ? camp.years.some((year) => String(year).includes(q))
          : false;

        return titleMatch || nameMatch || bodyMatch || tripTypeMatch || yearsMatch;
      });
    }

    if (yearFilter) {
      result = result.filter(
        (camp) =>
          Array.isArray(camp.years) &&
          camp.years.map(String).includes(String(yearFilter))
      );
    }

    result.sort((a, b) => {
      const minYearA =
        Array.isArray(a.years) && a.years.length ? Math.min(...a.years) : 9999;

      const minYearB =
        Array.isArray(b.years) && b.years.length ? Math.min(...b.years) : 9999;

      return sortOrder === "asc" ? minYearA - minYearB : minYearB - minYearA;
    });

    return result;
  }, [camps, search, yearFilter, sortOrder]);

  const clearFilters = () => {
    setSearch("");
    setYearFilter("");
    setSortOrder("asc");
  };

  const openApplyForm = (camp) => {
    if (!isLoggedin) {
      toast.error("Please log in first");
      navigate("/login");
      return;
    }

    if (!canApplyCamp) {
      toast.error("You are not allowed to apply for trips");
      return;
    }

    resetApplyForm();
    setSelectedCamp(camp);
    setShowApplyModal(true);
  };

  const closeApplyForm = () => {
    setShowApplyModal(false);
    setSelectedCamp(null);
    resetApplyForm();
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();

    if (!selectedCamp) {
      toast.error("No trip selected");
      return;
    }

    const applicationType = getApplicationType();

    if (!applicationType) {
      toast.error("Your role cannot apply for this trip");
      return;
    }

    if (applicationType === "parent_for_child") {
      if (!formData.childName || !formData.childYear || !formData.parentPhone) {
        toast.error("Child name, child year, and phone are required");
        return;
      }
    }

    if (applicationType === "child_self") {
      if (!formData.childName || !formData.childYear || !formData.parentPhone) {
        toast.error("Name, year, and phone are required");
        return;
      }
    }

    if (applicationType === "leader") {
      if (!formData.leaderName || !formData.leaderRole || !formData.parentPhone) {
        toast.error("Leader name, leader role, and phone are required");
        return;
      }
    }

    try {
      setApplyingCampId(selectedCamp._id);

      const payload = {
        applicationType,
        childName: formData.childName,
        childYear: formData.childYear,
        parentPhone: formData.parentPhone,
        leaderName: formData.leaderName,
        leaderRole: formData.leaderRole,
        notes: formData.notes,
      };

      const { data } = await axios.post(
        `${backendUrl}/api/camps/${selectedCamp._id}/apply`,
        payload
      );

      if (data.success) {
        toast.success(data.message || "Applied successfully");

        setCamps((prevCamps) =>
          prevCamps.map((camp) =>
            camp._id === selectedCamp._id ? data.camp || camp : camp
          )
        );

        closeApplyForm();
      } else {
        toast.error(data.message || "Failed to apply");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setApplyingCampId(null);
    }
  };

  const handleWithdraw = async (campId) => {
    const confirmed = window.confirm(
      "Are you sure you want to withdraw your application?"
    );

    if (!confirmed) return;

    try {
      setWithdrawingCampId(campId);

      const { data } = await axios.delete(`${backendUrl}/api/camps/${campId}/apply`);

      if (data.success) {
        toast.success(data.message || "Application withdrawn");

        setCamps((prevCamps) =>
          prevCamps.map((camp) => (camp._id === campId ? data.camp || camp : camp))
        );
      } else {
        toast.error(data.message || "Failed to withdraw");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setWithdrawingCampId(null);
    }
  };

  const handleDelete = async (campId) => {
    if (!canCreateCamp) {
      toast.error("You are not allowed to delete trips");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this trip? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingCampId(campId);

      const { data } = await axios.delete(`${backendUrl}/api/camps/${campId}`);

      if (data.success) {
        toast.success(data.message || "Trip deleted successfully");

        setCamps((prevCamps) =>
          prevCamps.filter((camp) => camp._id !== campId)
        );
      } else {
        toast.error(data.message || "Failed to delete trip");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setDeletingCampId(null);
    }
  };

  const getPreviewText = (text = "", maxLength = 120) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  const openNotifyModal = (camp) => {
  if (!canNotifyCamp) {
    toast.error("You are not allowed to notify participants");
    return;
  }

  setNotifyCamp(camp);
  setNotifySubject("");
  setNotifyMessage("");
};

const closeNotifyModal = () => {
  setNotifyCamp(null);
  setNotifySubject("");
  setNotifyMessage("");
};

const handleNotifySubmit = async (e) => {
  e.preventDefault();

  if (!notifyCamp) {
    toast.error("No trip selected");
    return;
  }

  if (!notifySubject.trim() || !notifyMessage.trim()) {
    toast.error("Subject and message are required");
    return;
  }

  try {
    setNotifyingCampId(notifyCamp._id);

    const { data } = await axios.post(
      `${backendUrl}/api/camps/${notifyCamp._id}/notify`,
      {
        subject: notifySubject,
        message: notifyMessage,
      }
    );

    if (data.success) {
      toast.success(data.message || "Notification sent successfully");
      closeNotifyModal();
    } else {
      toast.error(data.message || "Failed to send notification");
    }
  } catch (error) {
    toast.error(error.response?.data?.message || error.message);
  } finally {
    setNotifyingCampId(null);
  }
};

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      <Navbar/>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-indigo-50" />

          <div className="absolute inset-0">
            <Waves
              lineColor="#e4b54f"
              backgroundColor="rgba(255, 255, 255, 0)"
              waveSpeedX={0.08}
              waveSpeedY={0.03}
              waveAmpX={40}
              waveAmpY={20}
              friction={0.9}
              tension={0.01}
              maxCursorMove={320}
              xGap={10}
              yGap={20}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white" />

          <div className="relative z-10 flex h-full items-center justify-center px-12">
            <div className="max-w-md">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-gray-700 drop-shadow-md">
                Saint George Church Trips & Camps
              </p>

              <h1 className="mt-5 text-5xl font-semibold leading-tight text-gray-900">
                A Trip of labour with Christ.
              </h1>
            </div>
          </div>
        </div>

        <main className="px-4 pb-10 pt-40 sm:px-8 sm:pt-38 lg:px-16 lg:pt-28 lg:pb-28">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Trips & Camps
                </h1>
                <p className="mt-3 text-sm text-gray-500">
                  Search trips, outings, filter by year, and apply based on your role.
                </p>
              </div>

              {canCreateCamp && (
                <button
                  type="button"
                  onClick={() => navigate("/create-camp")}
                 className="h-12 rounded-xl bg-black px-6 text-sm font-medium text-white transition hover:bg-gray-800 shadow-md"
                >
                  Create Trip
                </button>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <input
                type="text"
                placeholder="Search by title, leader, type, body, or year"
                className="h-12 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="h-12 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="">All years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>

              <select
                className="h-12 rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="asc">Sort by year: Low to high</option>
                <option value="desc">Sort by year: High to low</option>
              </select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 rounded-xl border border-gray-300 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Clear
              </button>

              {!canApplyCamp && isLoggedin && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  You can view trips, but only parent, child, admin, leader, or
                  pascal roles can apply.
                </div>
              )}
            </div>

            <div className="mt-10">
              {loading ? (
                <p className="text-sm text-gray-500">Loading trips...</p>
              ) : filteredAndSortedCamps.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                  No trips found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {filteredAndSortedCamps.map((camp) => {
                    const applied = hasApplied(camp);

                    return (
                      <div
                        key={camp._id}
                        className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                      >
                        {camp.image && (
                          <img
                            src={camp.image}
                            alt={camp.title}
                            className="h-56 w-full object-cover"
                          />
                        )}

                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-2xl font-semibold text-gray-900">
                                {camp.title}
                              </h3>

                              <p className="mt-1 text-sm text-gray-500">
                                {camp.name || "Camp Team"}
                              </p>

                              {camp.TripType && (
                                <span className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                  {camp.TripType}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/camps/${camp._id}`, {
                                  state: { camp },
                                })
                              }
                              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              View
                            </button>
                          </div>

                          <p className="mt-4 text-sm leading-6 text-gray-700 whitespace-pre-line">
                            {getPreviewText(camp.body)}
                          </p>

                          <div className="mt-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                              Available years
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {Array.isArray(camp.years) &&
                              camp.years.length > 0 ? (
                                camp.years
                                  .slice()
                                  .sort((a, b) => a - b)
                                  .map((year) => (
                                    <span
                                      key={year}
                                      className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
                                    >
                                      Year {year}
                                    </span>
                                  ))
                              ) : (
                                <span className="text-sm text-gray-500">
                                  No years assigned
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                            {canNotifyCamp && (
                              <button
                                type="button"
                                onClick={() => openNotifyModal(camp)}
                                className="rounded-xl border border-amber-300 bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                              >
                                Notify
                              </button>
                            )}
                            {canCreateCamp && (
                              <button
                                type="button"
                                onClick={() => handleDelete(camp._id)}
                                disabled={deletingCampId === camp._id}
                                className="rounded-xl border border-red-300 bg-white px-6 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingCampId === camp._id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            )}

                            {applied ? (
                              <button
                                type="button"
                                onClick={() => handleWithdraw(camp._id)}
                                disabled={withdrawingCampId === camp._id}
                                className="rounded-xl border border-orange-300 bg-orange-50 px-6 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {withdrawingCampId === camp._id
                                  ? "Withdrawing..."
                                  : "Withdraw"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openApplyForm(camp)}
                                disabled={!canApplyCamp}
                                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-400"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showApplyModal && selectedCamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Apply for {selectedCamp.title}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Fill the required registration details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeApplyForm}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="mt-6 space-y-4">
              {isLeaderFormUser ? (
                <>
                  <input
                    type="text"
                    placeholder="Leader name"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.leaderName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        leaderName: e.target.value,
                      }))
                    }
                    required
                  />

                  <input
                    type="text"
                    placeholder="Leader role / service"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.leaderRole}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        leaderRole: e.target.value,
                      }))
                    }
                    required
                  />

                  <input
                    type="text"
                    placeholder="Phone number"
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.parentPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        parentPhone: e.target.value,
                      }))
                    }
                    required
                  />
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={isParent ? "Son / daughter name" : "Your name"}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.childName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        childName: e.target.value,
                      }))
                    }
                    required
                  />

                  <select
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={formData.childYear}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        childYear: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        Year {year}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder={isParent ? "Parent phone number" : "Phone number"}
                    className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.parentPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        parentPhone: e.target.value,
                      }))
                    }
                    required
                  />
                </>
              )}

              <textarea
                placeholder="Notes / special requests"
                rows="4"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none resize-y focus:ring-2 focus:ring-indigo-500"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeApplyForm}
                  className="h-12 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={applyingCampId === selectedCamp._id}
                  className="h-12 rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {applyingCampId === selectedCamp._id
                    ? "Submitting..."
                    : "Submit application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {notifyCamp && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Notify participants
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Send an email to all registered participants for{" "}
            <span className="font-medium text-gray-800">
              {notifyCamp.title}
            </span>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={closeNotifyModal}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <form onSubmit={handleNotifySubmit} className="mt-6 space-y-4">
        <input
          type="text"
          placeholder="Email subject"
          className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          value={notifySubject}
          onChange={(e) => setNotifySubject(e.target.value)}
          required
        />

        <textarea
          placeholder="Write your message to participants..."
          rows="8"
          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none resize-y focus:ring-2 focus:ring-indigo-500"
          value={notifyMessage}
          onChange={(e) => setNotifyMessage(e.target.value)}
          required
        />

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={closeNotifyModal}
            className="h-12 rounded-xl border border-gray-300 px-6 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={notifyingCampId === notifyCamp._id}
            className="h-12 rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {notifyingCampId === notifyCamp._id
              ? "Sending..."
              : "Send email"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
  );
};

export default Camp;