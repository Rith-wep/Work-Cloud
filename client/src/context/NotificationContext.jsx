import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

import { useAuth } from "./AuthContext.jsx";
import i18n from "../i18n.js";
import { toastNotification } from "../utils/toast.jsx";
import { getNotificationMessage } from "../utils/notifications.js";

const NotificationContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const normalizeAvatarUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
  }
  const base = SOCKET_BASE_URL;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

export function NotificationProvider({ children }) {
  const { token, isAuthenticated, refreshCurrentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch notifications");
      }
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to mark notifications as read");
    }
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, [token]);

  const markAsRead = useCallback(
    async (id) => {
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to mark notification as read");
      }
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
      );
    },
    [token]
  );

  const deleteNotification = useCallback(
    async (id) => {
      if (!token) return;
      const previousNotifications = notifications;
      setNotifications((prev) => prev.filter((item) => item._id !== id));
      try {
        const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to delete notification");
        }
      } catch (err) {
        setNotifications(previousNotifications);
        throw err;
      }
    },
    [notifications, token]
  );

  const clearAllNotifications = useCallback(async () => {
    if (!token) return;
    const previousNotifications = notifications;
    setNotifications([]);
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to clear notifications");
      }
    } catch (err) {
      setNotifications(previousNotifications);
      throw err;
    }
  }, [notifications, token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setNotifications([]);
      return undefined;
    }

    fetchNotifications();

    const socket = io(SOCKET_BASE_URL, {
      auth: { token: `Bearer ${token}` },
      transports: ["websocket", "polling"],
    });

    socket.on("new_notification", (payload) => {
      setNotifications((prev) => [payload, ...prev]);
      const senderPicture = payload?.senderId?.profilePicture || payload?.senderProfilePic || "";
      const senderName = payload?.senderId?.name || payload?.senderName || "";
      toastNotification({
        message: getNotificationMessage(payload, i18n.t.bind(i18n)),
        avatarUrl: normalizeAvatarUrl(senderPicture),
        senderName,
        fontClassName:
          payload?.type === "job_alert"
            ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
            : "",
      });
      if (["arrival_confirmed", "no_show_reported"].includes(String(payload?.type || ""))) {
        refreshCurrentUser().catch(() => {});
      }
    });

    socket.on("verification_completed", (payload) => {
      refreshCurrentUser().catch(() => {});
      window.dispatchEvent(new CustomEvent("verification:completed", { detail: payload }));
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchNotifications, isAuthenticated, refreshCurrentUser, token]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      fetchNotifications,
      markAllAsRead,
      markAsRead,
      deleteNotification,
      clearAllNotifications,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      error,
      fetchNotifications,
      markAllAsRead,
      markAsRead,
      deleteNotification,
      clearAllNotifications,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
