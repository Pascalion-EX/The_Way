import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Waves from "@/Components/Waves.jsx";
import Navbar from "../Components/Navbar.jsx";
import VideoRequestForm from "../Components/VideoRequestForm.jsx";

import { AppContent } from "../Context/AppContext.jsx";
import axios from "../utils/axios";


const PAGE_ROLES = [
  "Pamela",
  "leader",
  "pascal",
  "admin",
];


const STATUS_OPTIONS = [
  "Pending",
  "In Progress",
  "Completed",
  "Rejected",
];


const PRIORITY_OPTIONS = [
  "Low",
  "Normal",
  "High",
  "Urgent",
];


const VideoRequests = () => {
  const navigate = useNavigate();

  const {
    userData,
    backendUrl,
  } = useContext(AppContent);


  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [updatingId, setUpdatingId] =
    useState(null);

  const [deletingId, setDeletingId] =
    useState(null);


  // ============================================================
  // USER ROLES
  // ============================================================

  const roles = useMemo(() => {
    if (!userData?.role) {
      return [];
    }

    return Array.isArray(userData.role)
      ? userData.role
      : [userData.role];
  }, [userData]);


  const hasPageAccess = roles.some((role) =>
    PAGE_ROLES.includes(role)
  );


  const isPascal =
    roles.includes("pascal");


  // ============================================================
  // FETCH REQUESTS
  // ============================================================

  const fetchRequests = useCallback(
    async () => {
      if (!userData) {
        return;
      }

      try {
        setLoading(true);

        const endpoint = isPascal
          ? `${backendUrl}/api/video-requests`
          : `${backendUrl}/api/video-requests/my`;


        const { data } = await axios.get(
          endpoint,
          {
            withCredentials: true,
          }
        );


        if (data.success) {
          setRequests(data.requests || []);
        } else {
          toast.error(
            data.message ||
              "Failed to load video requests."
          );
        }

      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Failed to load video requests."
        );

      } finally {
        setLoading(false);
      }
    },
    [
      backendUrl,
      isPascal,
      userData,
    ]
  );


  useEffect(() => {
    if (!userData) {
      return;
    }


    if (!hasPageAccess) {
      setLoading(false);
      return;
    }


    fetchRequests();

  }, [
    userData,
    hasPageAccess,
    fetchRequests,
  ]);


  // ============================================================
  // NEW REQUEST CALLBACK
  // ============================================================

  const handleRequestCreated = (
    newRequest
  ) => {
    if (!newRequest) {
      fetchRequests();
      return;
    }


    setRequests((prev) => [
      newRequest,
      ...prev,
    ]);
  };


  // ============================================================
  // UPDATE REQUEST
  // PASCAL ONLY
  // ============================================================

  const updateRequest = async (
    id,
    changes
  ) => {
    if (!isPascal) {
      return;
    }


    try {
      setUpdatingId(id);


      const { data } = await axios.put(
        `${backendUrl}/api/video-requests/${id}`,
        changes,
        {
          withCredentials: true,
        }
      );


      if (!data.success) {
        toast.error(
          data.message ||
            "Failed to update request."
        );

        return;
      }


      setRequests((prev) =>
        prev.map((request) =>
          request._id === id
            ? data.request
            : request
        )
      );


      toast.success(
        "Request updated."
      );

    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update request."
      );

    } finally {
      setUpdatingId(null);
    }
  };


  // ============================================================
  // NOTES
  // ============================================================

  const handleNotesChange = (
    id,
    value
  ) => {
    setRequests((prev) =>
      prev.map((request) =>
        request._id === id
          ? {
              ...request,
              notes: value,
            }
          : request
      )
    );
  };


  // ============================================================
  // DELETE REQUEST
  // PASCAL ONLY
  // ============================================================

  const deleteRequest = async (
    id
  ) => {
    if (!isPascal) {
      return;
    }


    const confirmed =
      window.confirm(
        "Are you sure you want to delete this video editing request?"
      );


    if (!confirmed) {
      return;
    }


    try {
      setDeletingId(id);


      const { data } =
        await axios.delete(
          `${backendUrl}/api/video-requests/${id}`,
          {
            withCredentials: true,
          }
        );


      if (!data.success) {
        toast.error(
          data.message ||
            "Failed to delete request."
        );

        return;
      }


      setRequests((prev) =>
        prev.filter(
          (request) =>
            request._id !== id
        )
      );


      toast.success(
        "Request deleted."
      );

    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete request."
      );

    } finally {
      setDeletingId(null);
    }
  };


  // ============================================================
  // HELPERS
  // ============================================================

  const formatDate = (
    date
  ) => {
    if (!date) {
      return "No deadline";
    }


    return new Date(
      date
    ).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };


  const formatCreatedAt = (
    date
  ) => {
    if (!date) {
      return "";
    }


    return new Date(
      date
    ).toLocaleString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };


  const getStatusClasses = (
    status
  ) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-700";

      case "In Progress":
        return "bg-blue-100 text-blue-700";

      case "Rejected":
        return "bg-red-100 text-red-700";

      default:
        return "bg-amber-100 text-amber-700";
    }
  };


  const getPriorityClasses = (
    priority
  ) => {
    switch (priority) {
      case "Urgent":
        return "bg-red-100 text-red-700";

      case "High":
        return "bg-orange-100 text-orange-700";

      case "Low":
        return "bg-gray-100 text-gray-600";

      default:
        return "bg-blue-50 text-blue-700";
    }
  };


  // ============================================================
  // ACCESS DENIED
  // ============================================================

  if (
    userData &&
    !hasPageAccess
  ) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">

        {/* WAVES BACKGROUND */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <Waves
            lineColor="#e4b54f7e"
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


        {/* PAGE CONTENT */}
        <div className="relative z-10">
          <Navbar />
          <br/>

          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">

              <h1 className="text-2xl font-semibold text-gray-900">
                Access denied
              </h1>

              <p className="mt-3 text-gray-500">
                You do not have permission to access
                video editing requests.
              </p>

              <button
                onClick={() =>
                  navigate("/")
                }
                className="
                  mt-6 rounded-xl
                  bg-amber-500
                  px-5 py-2.5
                  font-medium text-white
                  transition
                  hover:bg-amber-600
                "
              >
                Return Home
              </button>

            </div>
          </div>
        </div>

      </div>
    );
  }


  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-900">

      {/* ======================================================
          WAVES BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none absolute inset-0 z-0">
        <Waves
          lineColor="#e4b54f7e"
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


      {/* ======================================================
          PAGE CONTENT
      ====================================================== */}

      <div className="relative z-10">

        <Navbar />
          <br/>



        <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">

          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="mb-8">

            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
              Media Service
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Video Editing Requests
            </h1>

            <p className="mt-2 max-w-2xl text-gray-500">
              Submit video editing work and follow
              its current progress.
            </p>

          </div>


          {/* ==================================================
              REQUEST FORM
          ================================================== */}

          <VideoRequestForm
            backendUrl={backendUrl}
            onRequestCreated={
              handleRequestCreated
            }
          />


          {/* ==================================================
              REQUEST LIST
          ================================================== */}

          <section className="mt-10">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

              <div>

                <h2 className="text-2xl font-semibold">

                  {isPascal
                    ? "Editing Queue"
                    : "My Requests"}

                </h2>

                <p className="mt-1 text-sm text-gray-500">

                  {isPascal
                    ? "Manage all submitted video editing requests."
                    : "Track the requests you have submitted."}

                </p>

              </div>


              <button
                onClick={
                  fetchRequests
                }
                disabled={
                  loading
                }
                className="
                  rounded-xl
                  border border-gray-300
                  bg-white
                  px-4 py-2
                  text-sm font-medium
                  transition
                  hover:bg-gray-50
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {loading
                  ? "Loading..."
                  : "Refresh"}
              </button>

            </div>


            {/* ==================================================
                LOADING
            ================================================== */}

            {loading ? (

              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500 shadow-sm">
                Loading requests...
              </div>

            ) : requests.length === 0 ? (

              /* ==================================================
                  EMPTY STATE
              ================================================== */

              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">

                <h3 className="text-lg font-semibold text-gray-800">
                  No requests yet
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Submitted video editing requests
                  will appear here.
                </p>

              </div>

            ) : (

              /* ==================================================
                  REQUEST CARDS
              ================================================== */

              <div className="space-y-5">

                {requests.map(
                  (request) => (

                    <article
                      key={
                        request._id
                      }
                      className="
                        rounded-2xl
                        border border-gray-200
                        bg-white
                        p-5
                        shadow-sm
                        sm:p-6
                      "
                    >

                      {/* ==========================================
                          REQUEST HEADER
                      ========================================== */}

                      <div className="flex flex-col justify-between gap-4 sm:flex-row">

                        <div>

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-xl font-semibold">
                              {
                                request.title
                              }
                            </h3>


                            {/* Status */}
                            <span
                              className={`
                                rounded-full
                                px-3 py-1
                                text-xs font-semibold
                                ${getStatusClasses(
                                  request.status
                                )}
                              `}
                            >
                              {
                                request.status
                              }
                            </span>


                            {/* Priority */}
                            <span
                              className={`
                                rounded-full
                                px-3 py-1
                                text-xs font-semibold
                                ${getPriorityClasses(
                                  request.priority
                                )}
                              `}
                            >
                              {
                                request.priority
                              }
                            </span>

                          </div>


                          {/* Requester */}
                          {request.requestedBy && (

                            <p className="mt-2 text-sm text-gray-500">

                              Requested by{" "}

                              <span className="font-medium text-gray-700">
                                {
                                  request
                                    .requestedBy
                                    .name
                                }
                              </span>


                              {request
                                .requestedBy
                                .email && (
                                <>
                                  {" "}
                                  •{" "}
                                  {
                                    request
                                      .requestedBy
                                      .email
                                  }
                                </>
                              )}

                            </p>

                          )}


                          {/* Created */}
                          <p className="mt-1 text-xs text-gray-400">

                            Submitted{" "}

                            {
                              formatCreatedAt(
                                request.createdAt
                              )
                            }

                          </p>

                        </div>


                        {/* Deadline */}
                        <div className="text-sm text-gray-500">

                          <span className="font-medium text-gray-700">
                            Deadline:
                          </span>{" "}

                          {
                            formatDate(
                              request.deadline
                            )
                          }

                        </div>

                      </div>


                      {/* ==========================================
                          DESCRIPTION
                      ========================================== */}

                      <div className="mt-5">

                        <h4 className="text-sm font-semibold text-gray-700">
                          Editing Instructions
                        </h4>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {
                            request.description
                          }
                        </p>

                      </div>


                      {/* ==========================================
                          LINKS
                      ========================================== */}

                      <div className="mt-5 flex flex-wrap gap-3">

                        <a
                          href={
                            request.videoLink
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                            rounded-lg
                            bg-gray-900
                            px-4 py-2
                            text-sm font-medium
                            text-white
                            transition
                            hover:bg-gray-700
                          "
                        >
                          Open Video Files
                        </a>


                        {request.referenceLink && (

                          <a
                            href={
                              request.referenceLink
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
                              rounded-lg
                              border border-gray-300
                              bg-white
                              px-4 py-2
                              text-sm font-medium
                              text-gray-700
                              transition
                              hover:bg-gray-50
                            "
                          >
                            Open Reference
                          </a>

                        )}

                      </div>


                      {/* ==========================================
                          PASCAL CONTROLS
                      ========================================== */}

                      {isPascal && (

                        <div className="mt-6 border-t border-gray-200 pt-6">

                          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Management
                          </h4>


                          <div className="grid gap-4 sm:grid-cols-2">


                            {/* ====================================
                                STATUS
                            ==================================== */}

                            <div>

                              <label className="mb-2 block text-sm font-medium">
                                Status
                              </label>


                              <select
                                value={
                                  request.status
                                }
                                disabled={
                                  updatingId ===
                                  request._id
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateRequest(
                                    request._id,
                                    {
                                      status:
                                        e.target.value,
                                    }
                                  )
                                }
                                className="
                                  w-full
                                  rounded-xl
                                  border border-gray-300
                                  bg-white
                                  px-4 py-3
                                  outline-none
                                  transition
                                  focus:border-amber-500
                                  focus:ring-2
                                  focus:ring-amber-200
                                  disabled:cursor-not-allowed
                                  disabled:opacity-60
                                "
                              >

                                {STATUS_OPTIONS.map(
                                  (
                                    status
                                  ) => (

                                    <option
                                      key={
                                        status
                                      }
                                      value={
                                        status
                                      }
                                    >
                                      {
                                        status
                                      }
                                    </option>

                                  )
                                )}

                              </select>

                            </div>


                            {/* ====================================
                                PRIORITY
                            ==================================== */}

                            <div>

                              <label className="mb-2 block text-sm font-medium">
                                Priority
                              </label>


                              <select
                                value={
                                  request.priority
                                }
                                disabled={
                                  updatingId ===
                                  request._id
                                }
                                onChange={(
                                  e
                                ) =>
                                  updateRequest(
                                    request._id,
                                    {
                                      priority:
                                        e.target.value,
                                    }
                                  )
                                }
                                className="
                                  w-full
                                  rounded-xl
                                  border border-gray-300
                                  bg-white
                                  px-4 py-3
                                  outline-none
                                  transition
                                  focus:border-amber-500
                                  focus:ring-2
                                  focus:ring-amber-200
                                  disabled:cursor-not-allowed
                                  disabled:opacity-60
                                "
                              >

                                {PRIORITY_OPTIONS.map(
                                  (
                                    priority
                                  ) => (

                                    <option
                                      key={
                                        priority
                                      }
                                      value={
                                        priority
                                      }
                                    >
                                      {
                                        priority
                                      }
                                    </option>

                                  )
                                )}

                              </select>

                            </div>

                          </div>


                          {/* ======================================
                              NOTES
                          ====================================== */}

                          <div className="mt-4">

                            <label className="mb-2 block text-sm font-medium">
                              Editor Notes
                            </label>


                            <textarea
                              rows={3}
                              value={
                                request.notes ||
                                ""
                              }
                              onChange={(
                                e
                              ) =>
                                handleNotesChange(
                                  request._id,
                                  e.target.value
                                )
                              }
                              placeholder="Add notes about the editing progress..."
                              className="
                                w-full
                                resize-y
                                rounded-xl
                                border border-gray-300
                                bg-white
                                px-4 py-3
                                outline-none
                                transition
                                focus:border-amber-500
                                focus:ring-2
                                focus:ring-amber-200
                              "
                            />

                          </div>


                          {/* ======================================
                              ACTIONS
                          ====================================== */}

                          <div className="mt-4 flex flex-wrap justify-end gap-3">


                            <button
                              onClick={() =>
                                updateRequest(
                                  request._id,
                                  {
                                    notes:
                                      request.notes ||
                                      "",
                                  }
                                )
                              }
                              disabled={
                                updatingId ===
                                request._id
                              }
                              className="
                                rounded-xl
                                bg-amber-500
                                px-5 py-2.5
                                text-sm font-semibold
                                text-white
                                transition
                                hover:bg-amber-600
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              {updatingId ===
                              request._id
                                ? "Saving..."
                                : "Save Notes"}
                            </button>


                            <button
                              onClick={() =>
                                deleteRequest(
                                  request._id
                                )
                              }
                              disabled={
                                deletingId ===
                                request._id
                              }
                              className="
                                rounded-xl
                                bg-red-50
                                px-5 py-2.5
                                text-sm font-semibold
                                text-red-600
                                transition
                                hover:bg-red-100
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                              "
                            >
                              {deletingId ===
                              request._id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>

                        </div>

                      )}

                    </article>

                  )
                )}

              </div>

            )}

          </section>

        </main>

      </div>

    </div>
  );
};


export default VideoRequests;