import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  Bell,
  CheckCheck,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { AppContent } from "../Context/AppContext.jsx";

const NotificationBell = () => {
  const { backendUrl } = useContext(AppContent);

  const [notifications, setNotifications] =
    useState([]);

  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [markingAll, setMarkingAll] =
    useState(false);

  const dropdownRef = useRef(null);

  const navigate = useNavigate();

  // ======================================================
  // FETCH NOTIFICATIONS
  // ======================================================

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const { data } = await axios.get(
        `${backendUrl}/api/notifications`,
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        setNotifications(
          data.notifications || []
        );

        return data.notifications || [];
      }

      return [];
    } catch (error) {
      console.error(
        "Failed to fetch notifications:",
        error.response?.data ||
          error.message
      );

      return [];
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // INITIAL FETCH
  // ======================================================

  useEffect(() => {
    fetchNotifications();
  }, []);

  // ======================================================
  // CLOSE WHEN CLICKING OUTSIDE
  // ======================================================

  useEffect(() => {
    const handleClickOutside = (
      event
    ) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleClickOutside
      );
    };
  }, []);

  // ======================================================
  // LOCK PAGE SCROLL WHILE OPEN
  // ======================================================

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  // ======================================================
  // UNREAD NOTIFICATIONS
  // ======================================================

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        notification.isSeen === false
    );

  // ======================================================
  // MARK ONE NOTIFICATION AS SEEN
  // ======================================================

  const markAsRead = async (
    notificationId
  ) => {
    try {
      const { data } = await axios.put(
        `${backendUrl}/api/notifications/${notificationId}/seen`,
        {},
        {
          withCredentials: true,
        }
      );

      if (!data.success) {
        console.error(
          "Mark notification as seen failed:",
          data.message
        );

        return false;
      }

      setNotifications(
        (previous) =>
          previous.map(
            (notification) =>
              notification._id ===
              notificationId
                ? {
                    ...notification,
                    isSeen: true,
                  }
                : notification
          )
      );

      return true;
    } catch (error) {
      console.error(
        "Failed to mark notification as seen:",
        error.response?.data ||
          error.message
      );

      return false;
    }
  };

  // ======================================================
  // MARK ALL NOTIFICATIONS AS SEEN
  // ======================================================

  const markAllAsRead = async () => {
    if (markingAll) {
      return false;
    }

    try {
      setMarkingAll(true);

      const { data } = await axios.put(
        `${backendUrl}/api/notifications/seen/all`,
        {},
        {
          withCredentials: true,
        }
      );

      if (!data.success) {
        console.error(
          "Mark all notifications as seen failed:",
          data.message
        );

        return false;
      }

      setNotifications(
        (previous) =>
          previous.map(
            (notification) => ({
              ...notification,
              isSeen: true,
            })
          )
      );

      return true;
    } catch (error) {
      console.error(
        "Failed to mark all notifications as seen:",
        error.response?.data ||
          error.message
      );

      return false;
    } finally {
      setMarkingAll(false);
    }
  };

  // ======================================================
  // BELL CLICK
  // ======================================================

  const handleBellClick = async () => {
    const willOpen = !open;

    setOpen(willOpen);

    if (!willOpen) {
      return;
    }

    /*
      Get the latest notifications first.
    */
    const latestNotifications =
      await fetchNotifications();

    /*
      Only send the request if at least
      one freshly fetched notification is unread.
    */
    const hasUnread =
      latestNotifications.some(
        (notification) =>
          notification.isSeen === false
      );

    if (hasUnread) {
      await markAllAsRead();
    }
  };

  // ======================================================
  // CLICK NOTIFICATION
  // ======================================================

  const handleNotificationClick =
    async (notification) => {
      /*
        Normally everything will already
        be marked as seen when the bell opens.

        This remains as a fallback.
      */

      if (!notification.isSeen) {
        await markAsRead(
          notification._id
        );
      }

      setOpen(false);

      if (
        notification.url &&
        typeof notification.url ===
          "string"
      ) {
        navigate(notification.url);
      }
    };

  // ======================================================
  // FORMAT DATE
  // ======================================================

  const formatDate = (date) => {
    if (!date) {
      return "";
    }

    const notificationDate =
      new Date(date);

    return notificationDate.toLocaleString();
  };

  // ======================================================
  // RETURN
  // ======================================================

  return (
    <div
      ref={dropdownRef}
      className="pointer-events-auto relative"
    >
      {/* ============================================== */}
      {/* BELL BUTTON */}
      {/* ============================================== */}

      <button
        type="button"
        onClick={handleBellClick}
        className="
          pointer-events-auto
          relative
          flex
          h-10
          w-10
          cursor-pointer
          items-center
          justify-center
          rounded-full
          border
          border-gray-200
          bg-white
          text-gray-700
          shadow-sm
          transition
          hover:bg-gray-100
          focus:outline-none
          focus:ring-2
          focus:ring-gray-300
          sm:h-11
          sm:w-11
        "
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={21} />

        {/* Unread Counter */}

        {unreadNotifications.length >
          0 && (
          <span
            className="
              absolute
              -right-1
              -top-1
              flex
              h-5
              min-w-5
              items-center
              justify-center
              rounded-full
              bg-red-500
              px-1
              text-[10px]
              font-bold
              text-white
            "
          >
            {unreadNotifications.length >
            99
              ? "99+"
              : unreadNotifications.length}
          </span>
        )}
      </button>

      {/* ============================================== */}
      {/* NOTIFICATION WINDOW */}
      {/* ============================================== */}

      {open && (
        <div
          onPointerDown={(event) =>
            event.stopPropagation()
          }
          onTouchStart={(event) =>
            event.stopPropagation()
          }
          className="
            pointer-events-auto

            fixed
            left-3
            right-3
            top-20

            z-[12000]

            max-h-[calc(100dvh-6rem)]

            overflow-hidden
            overscroll-contain

            rounded-2xl
            border
            border-gray-200
            bg-white
            shadow-2xl

            sm:absolute
            sm:left-auto
            sm:right-0
            sm:top-12
            sm:w-96
            sm:max-h-[420px]
          "
        >
          {/* ========================================== */}
          {/* HEADER */}
          {/* ========================================== */}

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-gray-100
              px-4
              py-3
            "
          >
            <div>
              <h2 className="font-semibold text-gray-900">
                Notifications
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                {unreadNotifications.length >
                0
                  ? `${unreadNotifications.length} unread`
                  : "You're all caught up"}
              </p>
            </div>

            {/* Mark All Seen */}

            {unreadNotifications.length >
              0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={(event) => {
                  event.stopPropagation();

                  markAllAsRead();
                }}
                className="
                  flex
                  cursor-pointer
                  items-center
                  gap-1.5
                  rounded-lg
                  px-2
                  py-1.5
                  text-xs
                  font-medium
                  text-indigo-600
                  transition
                  hover:bg-indigo-50
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <CheckCheck
                  size={15}
                />

                {markingAll
                  ? "Marking..."
                  : "Mark all seen"}
              </button>
            )}
          </div>

          {/* ========================================== */}
          {/* NOTIFICATION LIST */}
          {/* ========================================== */}

          <div
            className="
              max-h-[calc(100dvh-11rem)]

              overflow-y-auto
              overscroll-contain
              touch-pan-y

              sm:max-h-[350px]
            "
          >
            {/* Loading */}

            {loading &&
            notifications.length ===
              0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length ===
              0 ? (
              /*
                No Notifications
              */

              <div className="px-4 py-10 text-center">
                <Bell
                  size={30}
                  className="mx-auto mb-3 text-gray-300"
                />

                <p className="text-sm font-medium text-gray-600">
                  No notifications yet
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  New notifications will
                  appear here.
                </p>
              </div>
            ) : (
              /*
                Notifications
              */

              notifications.map(
                (notification) => (
                  <button
                    key={
                      notification._id
                    }
                    type="button"
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                    className={`
                      pointer-events-auto
                      relative
                      block
                      w-full
                      cursor-pointer
                      border-b
                      border-gray-100
                      px-4
                      py-4
                      text-left
                      transition
                      last:border-b-0
                      hover:bg-gray-50

                      ${
                        !notification.isSeen
                          ? "bg-indigo-50/70"
                          : "bg-white"
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread Dot */}

                      <div
                        className="
                          mt-1.5
                          flex
                          h-3
                          w-3
                          shrink-0
                          items-center
                          justify-center
                        "
                      >
                        {!notification.isSeen && (
                          <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        )}
                      </div>

                      {/* Content */}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          {/* Title */}

                          <h3
                            className={`
                              truncate
                              text-sm
                              text-gray-900

                              ${
                                !notification.isSeen
                                  ? "font-bold"
                                  : "font-medium"
                              }
                            `}
                          >
                            {notification.title ||
                              "Notification"}
                          </h3>

                          {/* New Badge */}

                          {!notification.isSeen && (
                            <span
                              className="
                                shrink-0
                                rounded-full
                                bg-indigo-100
                                px-2
                                py-0.5
                                text-[10px]
                                font-semibold
                                text-indigo-700
                              "
                            >
                              New
                            </span>
                          )}
                        </div>

                        {/* Message */}

                        {notification.message && (
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-600">
                            {
                              notification.message
                            }
                          </p>
                        )}

                        {/* Bottom Information */}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          {/* Date */}

                          <p className="text-xs text-gray-400">
                            {formatDate(
                              notification.createdAt
                            )}
                          </p>

                          {/* Open */}

                          {notification.url && (
                            <span className="shrink-0 text-xs font-medium text-indigo-600">
                              Open →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;