import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  FaBell,
  FaCheckCircle,
  FaClipboardList,
  FaStar,
  FaTimes,
  FaVideo,
} from "react-icons/fa/index.js";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../shared/context/AuthContext.jsx";
import { useNotifications } from "../../shared/context/NotificationContext.jsx";
import LazyAvatar from "../../shared/components/LazyAvatar.jsx";
import {
  getInterviewJoinWindowState,
  getNotificationKind,
  getNotificationMessage,
  getNotificationTargetPath,
  getNotificationTheme,
} from "../../shared/utils/notifications.js";

function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const {
    notifications,
    fetchNotifications,
    markAllAsRead,
    markAsRead,
    deleteNotification,
    clearAllNotifications,
    isLoading,
  } = useNotifications();
  const [error, setError] = useState("");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const imageBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(
    /\/api\/?$/,
    ""
  );

  useEffect(() => {
    fetchNotifications().catch((err) => setError(err.message));
  }, [fetchNotifications, token]);

  const formatTime = useMemo(
    () => (dateString) => {
      const now = Date.now();
      const then = new Date(dateString).getTime();
      const diffMins = Math.max(1, Math.floor((now - then) / 60000));
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    },
    []
  );

  const getNotificationIcon = (item) => {
    const kind = getNotificationKind(item);
    if (kind === "job_alert") {
      return FaStar;
    }
    if (kind === "application") {
      return FaClipboardList;
    }
    if (kind === "interview") {
      return FaVideo;
    }
    if (kind === "success") {
      return FaCheckCircle;
    }
    return FaBell;
  };

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-bold text-slate-900">{t("nav.notifications", { defaultValue: "Notifications" })}</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              setIsMarkingAll(true);
              await markAllAsRead();
            } catch (err) {
              setError(err.message);
            } finally {
              setIsMarkingAll(false);
            }
          }}
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
        >
          {isMarkingAll
            ? t("notifications.markingAll", { defaultValue: "Marking..." })
            : t("notifications.markAllRead", { defaultValue: "Mark all as read" })}
        </button>
        <button
          type="button"
          onClick={async () => {
            const confirmed = window.confirm("Are you sure you want to clear all?");
            if (!confirmed) {
              return;
            }
            try {
              setIsClearingAll(true);
              await clearAllNotifications();
            } catch (err) {
              setError(err.message);
            } finally {
              setIsClearingAll(false);
            }
          }}
          className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!notifications.length || isClearingAll}
        >
          {isClearingAll
            ? t("notifications.clearing", { defaultValue: "Clearing..." })
            : t("notifications.clearAll", { defaultValue: "Clear all" })}
        </button>
      </div>
      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-slate-500">
          {t("notifications.loading", { defaultValue: "Loading notifications..." })}
        </p>
      ) : null}
      {!isLoading && !notifications.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FaBell size={24} />
          </div>
          <p className="text-sm text-slate-500">
            {t("notifications.empty", { defaultValue: "No notifications yet." })}
          </p>
          <p className="mt-1 text-base text-slate-700 [font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]">
            {t("notifications.emptyFresh", {
              defaultValue: "មិនទាន់មានការជូនដំណឹងថ្មីឡើយ",
            })}
          </p>
        </div>
      ) : null}
      {!isLoading && (
        <AnimatePresence initial={false}>
        {notifications.map((item, index) => (
          <motion.article
            key={item._id}
            onClick={() => {
              if (!item.isRead) {
                markAsRead(item._id).catch(() => {});
              }
              navigate(getNotificationTargetPath(item, user?.role));
            }}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            className={`cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
              item.isRead ? "" : `ring-1 ${getNotificationTheme(item).ring}`
            }`}
          >
            {(() => {
              const theme = getNotificationTheme(item);
              const NotificationIcon = getNotificationIcon(item);
              const joinInterview = getInterviewJoinWindowState(item);
              const isKhmerJobAlert = item.type === "job_alert";
              return (
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <LazyAvatar
                  src={
                    (item.senderId?.profilePicture || item.senderProfilePic || "").startsWith("http://") ||
                    (item.senderId?.profilePicture || item.senderProfilePic || "").startsWith("https://")
                      ? item.senderId?.profilePicture || item.senderProfilePic || ""
                      : `${imageBaseUrl}${String(item.senderId?.profilePicture || item.senderProfilePic || "").startsWith("/") ? item.senderId?.profilePicture || item.senderProfilePic : `/${item.senderId?.profilePicture || item.senderProfilePic || ""}`}`
                  }
                  alt={item.senderId?.name || item.senderName || "Sender"}
                  name={item.senderId?.name || item.senderName || "N"}
                  className="h-10 w-10 shrink-0"
                  textClassName="text-sm"
                />
                <span
                  className={`absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${theme.accent}`}
                >
                  <NotificationIcon size={10} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {!item.isRead ? (
                    <span className={`inline-block h-2 w-2 rounded-full ${theme.dot}`} />
                  ) : null}
                  {t("notifications.title", { defaultValue: "Notification" })}
                </p>
                <p
                  className={`mt-1 text-sm text-slate-800 ${
                    isKhmerJobAlert ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]" : ""
                  }`}
                >
                  {getNotificationMessage(item, t)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatTime(item.createdAt)}</p>
                {joinInterview.canJoin && user?.role === "candidate" ? (
                  <a
                    href={joinInterview.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white"
                  >
                    <FaVideo size={11} />
                    <span>Join Interview</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={async (event) => {
                    event.stopPropagation();
                    try {
                      await deleteNotification(item._id);
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                  className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <FaTimes size={10} />
                  <span>{t("notifications.delete", { defaultValue: "Delete" })}</span>
                </button>
              </div>
            </div>
              );
            })()}
          </motion.article>
        ))}
        </AnimatePresence>
      )}
    </section>
  );
}

export default NotificationsPage;

