import React, {
  useContext,
  useEffect,
  useState,
} from "react";

import axios from "axios";
import { toast } from "react-toastify";

import { AppContent } from "../Context/AppContext.jsx";
import Navbar from "../Components/Navbar";
import Waves from "../Components/Waves.jsx";

const Profile = () => {
  const {
    userData,
    backendUrl,
    getUserData,
  } = useContext(AppContent);

  // ======================================================
  // PROFILE STATE
  // ======================================================

  const [isEditing, setIsEditing] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [editData, setEditData] =
    useState({
      name: "",
      email: "",
      phone: "",
      class: "",
    });

  // ======================================================
  // AVAILABLE NOTIFICATION ROLES
  // ======================================================

  const availableNotificationRoles = [
    "admin",
    "leader",
    "pascal",
    "pamela",
    "parent",
    "child",
    "unAssined",
  ];

  // ======================================================
  // CREATE NOTIFICATION STATE
  // ======================================================

  const [
    notificationFormOpen,
    setNotificationFormOpen,
  ] = useState(false);

  const [
    notificationLoading,
    setNotificationLoading,
  ] = useState(false);

  const [
    notificationData,
    setNotificationData,
  ] = useState({
    title: "",
    message: "",
    targetRoles: [],
    type: "None",
    url: "/",
  });

  // ======================================================
  // DELETE NOTIFICATIONS STATE
  // ======================================================

  const [
    deleteNotificationFormOpen,
    setDeleteNotificationFormOpen,
  ] = useState(false);

  const [
    deleteNotificationLoading,
    setDeleteNotificationLoading,
  ] = useState(false);

  const [
    deleteTargetRoles,
    setDeleteTargetRoles,
  ] = useState([]);

  // ======================================================
  // USER ROLES / PERMISSIONS
  // ======================================================

  const notificationManagementRoles = [
    "admin",
    "leader",
    "pascal",
    "pamela",
  ];

  const userRoles = (
    Array.isArray(userData?.role)
      ? userData.role
      : [userData?.role]
  )
    .filter(Boolean)
    .map((role) =>
      String(role).trim().toLowerCase()
    );

  const canManageNotifications =
    userRoles.some((role) =>
      notificationManagementRoles.includes(
        role
      )
    );

  // ======================================================
  // LOAD USER DATA
  // ======================================================

  useEffect(() => {
    if (userData) {
      setEditData({
        name: userData.name || "",
        email: userData.email || "",
        phone: userData.phone || "",
        class: userData.class || "",
      });
    }
  }, [userData]);

  // ======================================================
  // ROLE BADGE STYLE
  // ======================================================

  const getRoleBadgeStyle = (role) => {
    const normalizedRole =
      Array.isArray(role)
        ? role[0]
        : role;

    switch (
      String(
        normalizedRole || ""
      ).toLowerCase()
    ) {
      case "admin":
        return "bg-red-100 text-red-700 border-red-200";

      case "leader":
        return "bg-blue-100 text-blue-700 border-blue-200";

      case "pascal":
        return "bg-purple-100 text-purple-700 border-purple-200";

      case "pamela":
        return "bg-pink-100 text-pink-700 border-pink-200";

      case "parent":
        return "bg-green-100 text-green-700 border-green-200";

      case "child":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";

      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // ======================================================
  // FORMAT ROLE
  // ======================================================

  const formatRole = (role) => {
    if (!role) {
      return "User";
    }

    if (Array.isArray(role)) {
      return role.join(", ");
    }

    return role;
  };

  const displayRole = (role) => {
    if (role === "unAssined") {
      return "Unassigned";
    }

    return role;
  };

  // ======================================================
  // PROFILE INPUT CHANGE
  // ======================================================

  const handleChange = (e) => {
    const { name, value } =
      e.target;

    setEditData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ======================================================
  // CANCEL PROFILE EDIT
  // ======================================================

  const handleCancel = () => {
    setEditData({
      name: userData?.name || "",
      email: userData?.email || "",
      phone: userData?.phone || "",
      class: userData?.class || "",
    });

    setIsEditing(false);
  };

  // ======================================================
  // SAVE PROFILE
  // ======================================================

  const handleSave = async () => {
    try {
      setLoading(true);

      const { data } =
        await axios.put(
          `${backendUrl}/api/user/update-profile`,
          editData,
          {
            withCredentials: true,
          }
        );

      if (data.success) {
        toast.success(
          data.message ||
            "Profile updated successfully"
        );

        if (getUserData) {
          await getUserData();
        }

        setIsEditing(false);
      } else {
        toast.error(
          data.message ||
            "Failed to update profile"
        );
      }
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data
          ?.message ||
          "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // CREATE NOTIFICATION INPUT CHANGE
  // ======================================================

  const handleNotificationChange = (
    e
  ) => {
    const { name, value } =
      e.target;

    setNotificationData(
      (prev) => ({
        ...prev,
        [name]: value,
      })
    );
  };

  // ======================================================
  // CREATE NOTIFICATION ROLE SELECTION
  // ======================================================

  const handleRoleChange = (
    role
  ) => {
    setNotificationData(
      (prev) => {
        const alreadySelected =
          prev.targetRoles.includes(
            role
          );

        return {
          ...prev,

          targetRoles:
            alreadySelected
              ? prev.targetRoles.filter(
                  (item) =>
                    item !== role
                )
              : [
                  ...prev.targetRoles,
                  role,
                ],
        };
      }
    );
  };

  // ======================================================
  // CLOSE CREATE NOTIFICATION FORM
  // ======================================================

  const closeNotificationForm =
    () => {
      if (notificationLoading) {
        return;
      }

      setNotificationFormOpen(
        false
      );
    };

  // ======================================================
  // CREATE NOTIFICATION
  // ======================================================

  const handleCreateNotification =
    async (e) => {
      e.preventDefault();

      if (
        !notificationData.title.trim()
      ) {
        toast.error(
          "Notification title is required"
        );

        return;
      }

      if (
        !notificationData.message.trim()
      ) {
        toast.error(
          "Notification message is required"
        );

        return;
      }

      if (
        notificationData
          .targetRoles.length === 0
      ) {
        toast.error(
          "Select at least one target role"
        );

        return;
      }

      if (
        !notificationData.url.trim()
      ) {
        toast.error(
          "Notification URL is required"
        );

        return;
      }

      try {
        setNotificationLoading(
          true
        );

        const { data } =
          await axios.post(
            `${backendUrl}/api/notifications`,
            {
              title:
                notificationData.title.trim(),

              message:
                notificationData.message.trim(),

              targetRoles:
                notificationData.targetRoles,

              type:
                notificationData.type,

              url:
                notificationData.url.trim(),
            },
            {
              withCredentials:
                true,
            }
          );

        if (data.success) {
          toast.success(
            data.message ||
              "Notification sent successfully"
          );

          setNotificationData({
            title: "",
            message: "",
            targetRoles: [],
            type: "None",
            url: "/",
          });

          setNotificationFormOpen(
            false
          );
        } else {
          toast.error(
            data.message ||
              "Failed to create notification"
          );
        }
      } catch (error) {
        console.error(
          "Create notification error:",
          error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to create notification"
        );
      } finally {
        setNotificationLoading(
          false
        );
      }
    };

  // ======================================================
  // DELETE NOTIFICATION ROLE SELECTION
  // ======================================================

  const handleDeleteRoleChange = (
    role
  ) => {
    setDeleteTargetRoles(
      (previous) => {
        const alreadySelected =
          previous.includes(role);

        if (alreadySelected) {
          return previous.filter(
            (item) =>
              item !== role
          );
        }

        return [
          ...previous,
          role,
        ];
      }
    );
  };

  // ======================================================
  // CLOSE DELETE NOTIFICATION FORM
  // ======================================================

  const closeDeleteNotificationForm =
    () => {
      if (
        deleteNotificationLoading
      ) {
        return;
      }

      setDeleteNotificationFormOpen(
        false
      );
    };

  // ======================================================
  // DELETE NOTIFICATIONS BY ROLES
  // ======================================================

  const handleDeleteNotifications =
    async (e) => {
      e.preventDefault();

      if (
        deleteTargetRoles.length ===
        0
      ) {
        toast.error(
          "Select at least one target role"
        );

        return;
      }

      try {
        setDeleteNotificationLoading(
          true
        );

        const { data } =
          await axios.put(
            `${backendUrl}/api/notifications/clear/roles`,
            {
              targetRoles:
                deleteTargetRoles,
            },
            {
              withCredentials:
                true,
            }
          );

        if (data.success) {
          toast.success(
            data.message ||
              "Notifications deleted successfully"
          );

          setDeleteTargetRoles(
            []
          );

          setDeleteNotificationFormOpen(
            false
          );
        } else {
          toast.error(
            data.message ||
              "Failed to delete notifications"
          );
        }
      } catch (error) {
        console.error(
          "Delete notifications error:",
          error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to delete notifications"
        );
      } finally {
        setDeleteNotificationLoading(
          false
        );
      }
    };

  // ======================================================
  // RETURN
  // ======================================================

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">

      {/* Background */}

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

      <div className="relative z-10">
        <Navbar />
        <br/>


        <main className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-6 lg:px-8">
          <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* ====================================== */}
            {/* LEFT PROFILE CARD */}
            {/* ====================================== */}

            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">

                {/* Profile Picture */}

                <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50">
                  {userData?.profilePicture ? (
                    <img
                      src={`${backendUrl}${userData.profilePicture}`}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-black text-4xl font-bold text-white transition hover:bg-gray-800">
                      {userData?.name?.[0]?.toUpperCase() ||
                        "U"}
                    </span>
                  )}
                </div>

                {/* Name */}

                <h1 className="mt-5 text-2xl font-semibold text-gray-900">
                  {userData?.name ||
                    "Servant"}
                </h1>

                {/* Email */}

                <p className="mt-1 break-all text-sm text-gray-500">
                  {userData?.email ||
                    "No email available"}
                </p>

                {/* Role */}

                <div
                  className={`mt-4 inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium capitalize ${getRoleBadgeStyle(
                    userData?.role
                  )}`}
                >
                  {formatRole(
                    userData?.role
                  )}
                </div>
              </div>
            </div>

            {/* ====================================== */}
            {/* RIGHT DETAILS */}
            {/* ====================================== */}

            <div className="space-y-6 lg:col-span-2">

              {/* ==================================== */}
              {/* ACCOUNT INFORMATION */}
              {/* ==================================== */}

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-semibold text-gray-900">
                  Account Information
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                  {/* Full Name */}

                  <div>
                    <p className="text-sm text-gray-500">
                      Full Name
                    </p>

                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={
                          editData.name
                        }
                        onChange={
                          handleChange
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">
                        {userData?.name ||
                          "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Email */}

                  <div>
                    <p className="text-sm text-gray-500">
                      Email
                    </p>

                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={
                          editData.email
                        }
                        onChange={
                          handleChange
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 break-all font-medium text-gray-900">
                        {userData?.email ||
                          "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Role */}

                  <div>
                    <p className="text-sm text-gray-500">
                      Role
                    </p>

                    <p className="mt-1 font-medium capitalize text-gray-900">
                      {formatRole(
                        userData?.role
                      )}
                    </p>
                  </div>

                  {/* Account Status */}

                  <div>
                    <p className="text-sm text-gray-500">
                      Account Status
                    </p>

                    <p
                      className={`mt-1 font-medium ${
                        userData?.isAccountVerified
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {userData?.isAccountVerified
                        ? "Verified"
                        : "Not verified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ==================================== */}
              {/* PROFILE DETAILS */}
              {/* ==================================== */}

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-semibold text-gray-900">
                  Profile Details
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

                  {/* Phone */}

                  <div>
                    <p className="text-sm text-gray-500">
                      Phone
                    </p>

                    {isEditing ? (
                      <input
                        type="text"
                        name="phone"
                        value={
                          editData.phone
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Enter phone number"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">
                        {userData?.phone ||
                          "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Class */}

                  <div>
                    <p className="text-sm text-gray-500">
                      Class
                    </p>

                    {isEditing ? (
                      <input
                        type="number"
                        name="class"
                        value={
                          editData.class
                        }
                        onChange={
                          handleChange
                        }
                        placeholder="Enter class"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">
                        {userData?.class ||
                          "Not assigned"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ==================================== */}
              {/* ACTIONS */}
              {/* ==================================== */}

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Actions
                </h2>

                <div className="flex flex-col flex-wrap gap-3 sm:flex-row">

                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={
                          handleSave
                        }
                        disabled={
                          loading
                        }
                        className="rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading
                          ? "Saving..."
                          : "Save Changes"}
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleCancel
                        }
                        disabled={
                          loading
                        }
                        className="rounded-lg bg-gray-100 px-5 py-2.5 font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Edit Profile */}

                      <button
                        type="button"
                        onClick={() =>
                          setIsEditing(
                            true
                          )
                        }
                        className="rounded-lg bg-[#76C0EC] px-5 py-2.5 font-medium text-white transition hover:bg-[#256d97]"
                      >
                        Edit Profile
                      </button>

                      {/* Create Notification */}

                      {canManageNotifications && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteNotificationFormOpen(
                              false
                            );

                            setNotificationFormOpen(
                              true
                            );
                          }}
                          className="rounded-lg bg-[#BD5579] px-5 py-2.5 font-medium text-white transition hover:bg-[#83155d]"
                        >
                          Create Notification
                        </button>
                      )}

                      {/* Delete Notifications */}

                      {canManageNotifications && (
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationFormOpen(
                              false
                            );

                            setDeleteNotificationFormOpen(
                              true
                            );
                          }}
                          className="rounded-lg bg-[#E84C58] px-5 py-2.5 font-medium text-white transition hover:bg-[#9a3139]"
                        >
                          Delete Notifications
                        </button>
                      )}

                      {/* Verify Email */}

                      {!userData?.isAccountVerified && (
                        <button
                          type="button"
                          className="rounded-lg bg-gray-100 px-5 py-2.5 font-medium text-gray-700 transition hover:bg-gray-200"
                        >
                          Verify Email
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ================================================== */}
      {/* CREATE NOTIFICATION MODAL */}
      {/* ================================================== */}

      {notificationFormOpen && (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
          onClick={
            closeNotificationForm
          }
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            {/* Header */}

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Create Notification
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Send a notification
                  to selected users
                  based on their role.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeNotificationForm
                }
                disabled={
                  notificationLoading
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                aria-label="Close notification form"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleCreateNotification
              }
              className="space-y-5"
            >
              {/* Title */}

              <div>
                <label
                  htmlFor="notification-title"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Title
                </label>

                <input
                  id="notification-title"
                  type="text"
                  name="title"
                  value={
                    notificationData.title
                  }
                  onChange={
                    handleNotificationChange
                  }
                  placeholder="Notification title"
                  maxLength={100}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Message */}

              <div>
                <label
                  htmlFor="notification-message"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Message
                </label>

                <textarea
                  id="notification-message"
                  name="message"
                  value={
                    notificationData.message
                  }
                  onChange={
                    handleNotificationChange
                  }
                  placeholder="Write notification message..."
                  rows={4}
                  required
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Target Roles */}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Target Roles
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableNotificationRoles.map(
                    (role) => {
                      const selected =
                        notificationData.targetRoles.includes(
                          role
                        );

                      return (
                        <button
                          key={
                            role
                          }
                          type="button"
                          onClick={() =>
                            handleRoleChange(
                              role
                            )
                          }
                          className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition ${
                            selected
                              ? "border-purple-600 bg-purple-600 text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                        >
                          {displayRole(
                            role
                          )}
                        </button>
                      );
                    }
                  )}
                </div>

                {notificationData
                  .targetRoles
                  .length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {
                      notificationData
                        .targetRoles
                        .length
                    }{" "}
                    role
                    {notificationData
                      .targetRoles
                      .length !== 1
                      ? "s"
                      : ""}{" "}
                    selected
                  </p>
                )}
              </div>

              {/* Type */}

              <div>
                <label
                  htmlFor="notification-type"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Type
                </label>

                <select
                  id="notification-type"
                  name="type"
                  value={
                    notificationData.type
                  }
                  onChange={
                    handleNotificationChange
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="None">
                    General
                  </option>

                  <option value="Event">
                    Event
                  </option>

                  <option value="Lesson">
                    Lesson
                  </option>

                  <option value="Activity">
                    Activity
                  </option>

                  <option value="Announcement">
                    Announcement
                  </option>
                </select>
              </div>

              {/* URL */}

              <div>
                <label
                  htmlFor="notification-url"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Destination URL
                </label>

                <input
                  id="notification-url"
                  type="text"
                  name="url"
                  value={
                    notificationData.url
                  }
                  onChange={
                    handleNotificationChange
                  }
                  placeholder="/calendar"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />

                <p className="mt-1.5 text-xs text-gray-400">
                  Where the user will
                  go after clicking the
                  notification. Examples:
                  /calendar, /lessons,
                  /activities
                </p>
              </div>

              {/* Actions */}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeNotificationForm
                  }
                  disabled={
                    notificationLoading
                  }
                  className="rounded-xl border border-gray-300 px-5 py-2.5 font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    notificationLoading
                  }
                  className="rounded-xl bg-purple-600 px-5 py-2.5 font-medium text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {notificationLoading
                    ? "Sending..."
                    : "Send Notification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* DELETE NOTIFICATIONS MODAL */}
      {/* ================================================== */}

      {deleteNotificationFormOpen && (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
          onClick={
            closeDeleteNotificationForm
          }
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            {/* Header */}

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Delete Notifications
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Select the roles whose
                  notifications you want
                  to remove.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeDeleteNotificationForm
                }
                disabled={
                  deleteNotificationLoading
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                aria-label="Close delete notifications form"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                handleDeleteNotifications
              }
              className="space-y-5"
            >
              {/* Warning */}

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">
                  Delete notifications
                  for selected roles
                </p>

                <p className="mt-1 text-xs leading-5 text-red-600">
                  The selected roles will
                  be removed from matching
                  notifications. If a
                  notification has no
                  target roles remaining,
                  it will be deleted.
                </p>
              </div>

              {/* Target Roles */}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Target Roles
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {availableNotificationRoles.map(
                    (role) => {
                      const selected =
                        deleteTargetRoles.includes(
                          role
                        );

                      return (
                        <button
                          key={
                            role
                          }
                          type="button"
                          onClick={() =>
                            handleDeleteRoleChange(
                              role
                            )
                          }
                          className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition ${
                            selected
                              ? "border-red-200 bg-[#E84C58] text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50"
                          }`}
                        >
                          {displayRole(
                            role
                          )}
                        </button>
                      );
                    }
                  )}
                </div>

                {deleteTargetRoles.length >
                  0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {
                      deleteTargetRoles.length
                    }{" "}
                    role
                    {deleteTargetRoles.length !==
                    1
                      ? "s"
                      : ""}{" "}
                    selected
                  </p>
                )}
              </div>

              {/* Delete Actions */}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeDeleteNotificationForm
                  }
                  disabled={
                    deleteNotificationLoading
                  }
                  className="rounded-xl border border-gray-300 px-5 py-2.5 font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    deleteNotificationLoading ||
                    deleteTargetRoles.length ===
                      0
                  }
                  className="rounded-xl bg-[#E84C58] px-5 py-2.5 font-medium text-white transition hover:bg-[#9a3139] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteNotificationLoading
                    ? "Deleting..."
                    : "Delete Notifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;