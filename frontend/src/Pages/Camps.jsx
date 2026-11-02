import ContentImage from "../Components/ContentImage.jsx";
import Pagination from "../Components/Pagination.jsx";
import usePaginatedList from "../hooks/usePaginatedList.js";
import React, { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios";
import { toast } from "react-toastify";

import Navbar from "@/Components/Navbar.jsx";

const Camp = () => {
  const navigate = useNavigate();
  const { backendUrl, userData, isLoggedin } = useContext(AppContent);

  const {
    items: camps, setItems: setCamps, loading, pagination, setPage, setFilters, refresh,
    filters: { search, year: yearFilter, sortOrder },
  } = usePaginatedList({
    url: `${backendUrl}/api/camps`,
    dataKey: "camps",
    initialFilters: { search: "", year: "0", sortOrder: "asc" },
    debounce: 300,
  });
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
  const applyRoles = ["parent", "admin", "leader", "pascal"];
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

  const hasApplied = (camp) => camp.hasApplied === true;

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

  const clearFilters = () => {
    setFilters({ search: "", year: "0", sortOrder: "asc" });
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
            camp._id === selectedCamp._id ? { ...camp, hasApplied: data.camp?.hasApplied === true } : camp
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
          prevCamps.map((camp) => (camp._id === campId ? { ...camp, hasApplied: data.camp?.hasApplied === true } : camp))
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

        refresh();
      } else {
        toast.error(data.message || "Failed to delete trip");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setDeletingCampId(null);
    }
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
    <div className="relative isolate min-h-screen text-gray-900 bg-transparent">
      <Navbar/>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-transparent">
        <div className="relative hidden overflow-hidden lg:block">

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

        <main className="min-w-0 px-4 pb-10 pt-40 sm:px-8 lg:px-12 lg:pb-28 lg:pt-38 xl:px-16">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Trips & Camps
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-500 sm:text-base">
                Search trips, outings, filter by year, and apply based on your role.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                type="text"
                placeholder="Search by title, leader, type, body, or year"
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2"
                value={search}
                onChange={(e) => setFilters((previous) => ({ ...previous, search: e.target.value }))}
              />

              <select
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                aria-label="Filter by year"
                value={yearFilter}
                onChange={(e) => setFilters((previous) => ({ ...previous, year: e.target.value }))}
              >
                <option value="0">0 — All years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>

              <select
                className="h-12 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={sortOrder}
                onChange={(e) => setFilters((previous) => ({ ...previous, sortOrder: e.target.value }))}
              >
                <option value="asc">Sort by year: Low to high</option>
                <option value="desc">Sort by year: High to low</option>
              </select>
              <button
                type="button"
                onClick={clearFilters}
                className="h-12 w-full rounded-xl border border-gray-300 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Clear
              </button>

              {canCreateCamp && (
                <button
                  type="button"
                  onClick={() => navigate("/create-camp")}
                  className="h-12 w-full rounded-xl bg-black px-6 text-sm font-medium text-white shadow-md transition hover:bg-gray-800 md:col-span-2 xl:col-span-1"
                >
                  Create Trip
                </button>
              )}
            </div>

            <div className="mt-8 sm:mt-10">
              {loading ? (
                <p className="text-sm text-gray-500">Loading trips...</p>
              ) : camps.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 sm:p-6">
                  No trips found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {camps.map((camp) => {
                    const applied = hasApplied(camp);

                    return (
                      <div
                        key={camp._id}
                        className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                      >
                        {camp.image && (
                          <ContentImage
                            src={camp.image}
                            alt={camp.title}
                            className="h-40 w-full object-cover sm:h-48 lg:h-56"
                          />
                        )}

                        <div className="p-4 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-2xl font-semibold text-gray-900">
                                {camp.title}
                              </h3>

                              <p className="mt-1 text-sm text-gray-500">
                                {camp.name || "Camp Team"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/camps/${camp._id}`)
                              }
                              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              View
                            </button>
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
              <Pagination pagination={pagination} onPageChange={setPage} loading={loading} />
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
