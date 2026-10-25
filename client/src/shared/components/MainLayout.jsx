import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBell,
  FaBookmark,
  FaClipboardList,
  FaCheckCircle,
  FaBriefcase,
  FaHome,
  FaMapMarkerAlt,
  FaPlusCircle,
  FaSearch,
  FaStar,
  FaBuilding,
  FaLock,
  FaTimes,
  FaVideo,
} from "react-icons/fa/index.js";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import LazyAvatar from "./LazyAvatar.jsx";
import { useNotifications } from "../context/NotificationContext.jsx";
import { getAdminConsoleUrl } from "../utils/hostRouting.js";
import {
  getInterviewJoinWindowState,
  getNotificationKind,
  getNotificationMessage,
  getNotificationTargetPath,
  getNotificationTheme,
} from "../utils/notifications.js";
import { calculateMatchScore, toSkillKey } from "../utils/skills.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const KHMER_TEXT_REGEX = /[\u1780-\u17FF]/;

const containsKhmer = (value = "") => KHMER_TEXT_REGEX.test(String(value || ""));
const resolveImageUrl = (rawValue = "", imageBaseUrl = "") => {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
  }
  return `${imageBaseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
};
const DEFAULT_AVATAR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect width="80" height="80" rx="40" fill="#EEF2FF"/>
    <circle cx="40" cy="31" r="14" fill="#C7D2FE"/>
    <path d="M16 68c4.5-12.5 15.2-19 24-19s19.5 6.5 24 19" fill="#A5B4FC"/>
  </svg>
`)}`;

function MainLayout({ children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { unreadCount, notifications, markAsRead, deleteNotification, clearAllNotifications } =
    useNotifications();
  const location = useLocation();
  const notificationMenuRef = useRef(null);
  const [jobs, setJobs] = useState([]);
  const [employerApplications, setEmployerApplications] = useState([]);
  const [employerStats, setEmployerStats] = useState({ applicantsCount: 0, viewsCount: 0 });
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isClearingNotifications, setIsClearingNotifications] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [animatedTrustScore, setAnimatedTrustScore] = useState(0);
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const isEmployer = user?.role === "employer";
  const hasAdminAccess = Boolean(user?.isAdmin);
  const imageBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    return apiBase.replace(/\/api\/?$/, "");
  }, []);

  const desktopNav = isEmployer
    ? [
        { key: "dashboard", to: "/workspace", icon: FaHome, label: t("nav.dashboard") },
        { key: "listings", to: "/workspace?tab=listings", icon: FaClipboardList, label: t("nav.listings") },
        { key: "map", to: "/map", icon: FaMapMarkerAlt, label: t("nav.map", { defaultValue: "Map" }) },
        { key: "company", to: "/profile", icon: FaBuilding, label: t("nav.company", { defaultValue: "Company" }) },
      ]
    : [
        { key: "home", to: "/jobs", icon: FaHome, label: t("nav.home", { defaultValue: "Home" }) },
        { key: "map", to: "/map", icon: FaMapMarkerAlt, label: t("nav.map", { defaultValue: "Map" }) },
        { key: "applications", to: "/my-apps", icon: FaClipboardList, label: t("nav.myApps", { defaultValue: "My Apps" }) },
        { key: "saved", to: "/saved-jobs", icon: FaBookmark, label: t("nav.savedJobs", { defaultValue: "Saved Jobs" }) },
      ];

  const mobileNav = isEmployer
    ? [
        { key: "dashboard", to: "/workspace", icon: FaHome, label: t("nav.dashboard") },
        { key: "listings", to: "/workspace?tab=listings", icon: FaClipboardList, label: t("nav.listings") },
        { key: "map", to: "/map", icon: FaMapMarkerAlt, label: t("nav.map", { defaultValue: "Map" }) },
        { key: "profile", to: "/profile", icon: FaBuilding, label: t("nav.profile", { defaultValue: "Profile" }) },
      ]
    : [
        { key: "home", to: "/jobs", icon: FaHome, label: t("nav.home", { defaultValue: "Home" }) },
        { key: "map", to: "/map", icon: FaMapMarkerAlt, label: t("nav.map", { defaultValue: "Map" }) },
        { key: "applications", to: "/my-apps", icon: FaClipboardList, label: t("nav.myApps", { defaultValue: "My Apps" }) },
        { key: "saved", to: "/saved-jobs", icon: FaBookmark, label: t("nav.saved", { defaultValue: "Saved" }) },
      ];

  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        setIsSidebarLoading(true);
        if (isEmployer) {
          const [jobsResponse, applicationsResponse, statsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/jobs/my`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE_URL}/applications/employer`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_BASE_URL}/stats/employer`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          const jobsData = await jobsResponse.json();
          const applicationsData = await applicationsResponse.json();
          const statsData = await statsResponse.json();
          if (jobsResponse.ok) {
            setJobs(jobsData.jobs || []);
          }
          if (applicationsResponse.ok) {
            setEmployerApplications(applicationsData.applications || []);
          }
          if (statsResponse.ok) {
            setEmployerStats({
              applicantsCount: Number(statsData?.stats?.applicantsCount || 0),
              viewsCount: Number(statsData?.stats?.viewsCount || 0),
            });
          } else {
            setEmployerStats({ applicantsCount: 0, viewsCount: 0 });
          }
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/jobs`,
          token
            ? {
                headers: { Authorization: `Bearer ${token}` },
              }
            : undefined
        );
        const data = await response.json();
        if (response.ok) {
          setJobs(data.jobs || []);
        }
      } catch {
        setJobs([]);
        setEmployerApplications([]);
        setEmployerStats({ applicantsCount: 0, viewsCount: 0 });
      } finally {
        setIsSidebarLoading(false);
      }
    };

    fetchSidebarData();
  }, [isEmployer, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!notificationMenuRef.current) return;
      if (!notificationMenuRef.current.contains(event.target)) {
        setIsNotificationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let frameId = null;
    const durationMs = 1100;
    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    const step = (timestamp) => {
      const now = typeof timestamp === "number" ? timestamp : Date.now();
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setAnimatedTrustScore(Math.round(Math.max(0, Math.min(100, Number(user?.trustScore || 0))) * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    setAnimatedTrustScore(0);
    frameId = window.requestAnimationFrame(step);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [user?.trustScore]);

  const topEarners = useMemo(() => {
    const seen = new Map();
    jobs.forEach((job) => {
      const employer = job?.employerId;
      if (!employer?._id) {
        return;
      }
      if (!seen.has(employer._id)) {
        seen.set(employer._id, employer);
      }
    });

    return Array.from(seen.values())
      .sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0))
      .slice(0, 4);
  }, [jobs]);

  const suggestedJobs = useMemo(() => {
    if (isEmployer) {
      return [];
    }

    const selectedCategories = Array.isArray(user?.preferredCategories) && user.preferredCategories.length
      ? user.preferredCategories
      : user?.preferredCategory
        ? [user.preferredCategory]
        : [];
    const selectedSkills = Array.isArray(user?.skills) ? user.skills : [];

    const selectedCategoryKeys = new Set(
      selectedCategories.map((entry) => toSkillKey(String(entry || "").trim())).filter(Boolean)
    );
    const selectedSkillKeys = new Set(
      selectedSkills.map((entry) => toSkillKey(String(entry || "").trim())).filter(Boolean)
    );

    const matchProfile = {
      selectedCategories,
      selectedSkills,
    };
    const jobsByCategory = jobs.filter((job) =>
      selectedCategoryKeys.has(toSkillKey(String(job?.category || "").trim()))
    );

    return jobsByCategory
      .map((job) => ({
        ...job,
        __matchScore: calculateMatchScore(matchProfile, job),
      }))
      .sort((a, b) => b.__matchScore - a.__matchScore)
      .slice(0, 5);
  }, [isEmployer, jobs, user?.preferredCategories, user?.preferredCategory, user?.skills]);
  const activeJobStats = useMemo(() => {
    const views = Number(employerStats?.viewsCount || 0);
    const applicants = Number(employerStats?.applicantsCount || 0);
    return { views, applicants };
  }, [employerStats?.applicantsCount, employerStats?.viewsCount]);
  const nearbyCandidates = useMemo(() => {
    const unique = new Map();
    employerApplications.forEach((application) => {
      const candidate = application?.candidateId;
      if (!candidate?._id || unique.has(candidate._id)) {
        return;
      }
      unique.set(candidate._id, candidate);
    });
    return Array.from(unique.values()).slice(0, 4);
  }, [employerApplications]);
  const trustScore = Number(user?.trustScore || 0);
  const normalizedTrustScore = Math.max(0, Math.min(100, trustScore));
  const gaugeRadius = 54;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeProgress = normalizedTrustScore / 100;
  const userAvatarUrl = useMemo(() => {
    return resolveImageUrl(isEmployer ? user?.companyLogo || "" : user?.profilePicture || "", imageBaseUrl);
  }, [imageBaseUrl, isEmployer, user?.companyLogo, user?.profilePicture]);
  const isUserOnline = Boolean(user && token && isBrowserOnline);
  const formatNotificationTime = (dateString) => {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffMins = Math.max(1, Math.floor((now - then) / 60000));
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };
  const getNotificationAvatar = (item) => {
    const raw = String(item?.senderId?.profilePicture || item?.senderProfilePic || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
    }
    return `${imageBaseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
  };

  const quickConfirmArrival = async (notificationItem) => {
    try {
      const applicationId = notificationItem?.metadata?.applicationId;
      if (!applicationId) {
        return;
      }
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/confirm-arrival`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      await markAsRead(notificationItem._id);
    } catch {
      // noop for quick action
    }
  };

  const handleNotificationOpen = async (notificationItem) => {
    const targetPath = getNotificationTargetPath(notificationItem, user?.role);
    if (!notificationItem?.isRead) {
      markAsRead(notificationItem._id).catch(() => {});
    }
    setIsNotificationMenuOpen(false);
    navigate(targetPath);
  };

  const handleDeleteNotification = async (event, notificationId) => {
    event.stopPropagation();
    try {
      await deleteNotification(notificationId);
    } catch {
      // noop
    }
  };

  const handleClearAllNotifications = async () => {
    const confirmed = window.confirm("Are you sure you want to clear all?");
    if (!confirmed) {
      return;
    }
    try {
      setIsClearingNotifications(true);
      await clearAllNotifications();
    } catch {
      // noop
    } finally {
      setIsClearingNotifications(false);
    }
  };

  const getNotificationIcon = (notificationItem) => {
    const kind = getNotificationKind(notificationItem);
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
    <div className="min-h-screen bg-gray-100">
      <header className="wc-nav-surface sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-3">
          <div className="wc-nav-label pr-1 text-xl font-black tracking-tight text-primary">WorkCloud</div>
          <div className="hidden flex-1 md:flex">
            <div className="relative w-full">
              <FaSearch
                size={20}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder={t("dashboard.searchPlaceholder", { defaultValue: "Search jobs or locations" })}
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 pl-11 pr-4 text-sm outline-none focus:bg-white"
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {hasAdminAccess ? (
              <a
                href={getAdminConsoleUrl("/")}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
                style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
              >
                <FaLock size={14} />
                <span>Admin Console</span>
              </a>
            ) : null}
            {isEmployer ? (
              <NavLink
                to="/post-job"
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-indigo-700 md:px-3 md:py-2 md:text-xs"
                title={t("employer.postJob", { defaultValue: "Post a Job" })}
              >
                <FaPlusCircle size={16} />
                <span className="wc-nav-label">{t("employer.postJob", { defaultValue: "Post a Job" })}</span>
              </NavLink>
            ) : null}
            <div ref={notificationMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationMenuOpen((prev) => !prev)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <FaBell size={20} />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {isNotificationMenuOpen ? (
                <div className="fixed left-2 right-2 top-16 z-50 rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(92vw,360px)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <p className="truncate pr-2 text-sm font-bold text-slate-900">
                      {t("nav.notifications", { defaultValue: "Notifications" })}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClearAllNotifications}
                        disabled={!notifications.length || isClearingNotifications}
                        className="shrink-0 text-xs font-semibold text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        {isClearingNotifications
                          ? t("notifications.clearing", { defaultValue: "Clearing..." })
                          : t("notifications.clearAll", { defaultValue: "Clear all" })}
                      </button>
                      <NavLink
                        to="/notifications"
                        onClick={() => setIsNotificationMenuOpen(false)}
                        className="shrink-0 text-xs font-semibold text-primary"
                      >
                        {t("notifications.viewAll", { defaultValue: "View all" })}
                      </NavLink>
                    </div>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto sm:max-h-80">
                    <AnimatePresence initial={false}>
                      {notifications.slice(0, 8).map((item) => {
                        const avatarUrl = getNotificationAvatar(item);
                        const senderName = String(item?.senderId?.name || item?.senderName || "N");
                        const theme = getNotificationTheme(item);
                        const joinInterview = getInterviewJoinWindowState(item);
                        const NotificationIcon = getNotificationIcon(item);
                        const isKhmerJobAlert = item.type === "job_alert";
                        return (
                          <motion.div
                            key={item._id}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`w-full px-3 py-2 hover:bg-slate-50 ${
                              item.isRead ? "" : `bg-white ring-1 ${theme.ring}`
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleNotificationOpen(item)}
                                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                >
                                  <div className="relative shrink-0">
                                    <LazyAvatar
                                      src={avatarUrl}
                                      alt={senderName}
                                      name={senderName}
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
                                    <p
                                      className={`line-clamp-2 text-sm text-slate-800 ${
                                        isKhmerJobAlert ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]" : ""
                                      }`}
                                    >
                                      {!item.isRead ? (
                                        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${theme.dot} align-middle`} />
                                      ) : null}
                                      {getNotificationMessage(item, t)}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatNotificationTime(item.createdAt)}
                                    </p>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => handleDeleteNotification(event, item._id)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-rose-500"
                                  title={t("notifications.delete", { defaultValue: "Delete" })}
                                >
                                  <FaTimes size={12} />
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2 pl-[52px]">
                                {joinInterview.canJoin && user?.role === "candidate" ? (
                                  <a
                                    href={joinInterview.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white"
                                  >
                                    <FaVideo size={11} />
                                    <span>Join Interview</span>
                                  </a>
                                ) : null}
                                {isEmployer &&
                                item.type === "arrival_submitted" &&
                                item.metadata?.applicationId &&
                                !item.isRead ? (
                                  <button
                                    type="button"
                                    onClick={() => quickConfirmArrival(item)}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white"
                                  >
                                    <FaCheckCircle size={11} />
                                    <span>Confirm</span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {!notifications.length ? (
                      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <FaBell size={20} />
                        </div>
                        <p className="text-sm text-slate-500">
                          {t("notifications.empty", { defaultValue: "No notifications yet." })}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 [font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]">
                          {t("notifications.emptyFresh", {
                            defaultValue: "មិនទាន់មានការជូនដំណឹងថ្មីឡើយ",
                          })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <NavLink
              to="/profile"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 transition hover:ring-indigo-200"
            >
              <LazyAvatar
                src={userAvatarUrl}
                alt={user?.name || "User"}
                name={user?.name || "U"}
                className="h-9 w-9 ring-1 ring-white"
                textClassName="text-xs"
              />
              {isUserOnline ? (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]" />
              ) : null}
            </NavLink>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-3 pb-24 pt-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block">
          <div className="wc-nav-surface fixed top-20 w-[220px] space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-md">
            {desktopNav.map((item) => (
              <NavLink key={item.key} to={item.to}>
                {({ isActive }) => {
                  const Icon = item.icon;
                  const isEmployerDashboardTab = isEmployer && item.key === "dashboard";
                  const isEmployerListingsTab = isEmployer && item.key === "listings";
                  const currentTab = new URLSearchParams(location.search).get("tab");
                  const computedActive = isEmployerDashboardTab
                    ? location.pathname === "/workspace" && currentTab !== "listings"
                    : isEmployerListingsTab
                      ? location.pathname === "/workspace" && currentTab === "listings"
                      : isActive;
                  return (
                    <span
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                        computedActive ? "bg-indigo-50 text-primary" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon size={20} className={computedActive ? "text-primary" : "text-slate-500"} />
                      <span className="wc-nav-label">{item.label}</span>
                    </span>
                  );
                }}
              </NavLink>
            ))}
          </div>
        </aside>

        <main>{children}</main>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-3">
            {isEmployer ? (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">{t("workspace.activeJobStats", { defaultValue: "Active Job Stats" })}</h3>
                  <ul className="mt-3 space-y-2">
                    <li className="rounded-xl bg-slate-50 p-2 text-xs text-slate-700">
                      <p className="text-slate-500">{t("workspace.numberOfViews", { defaultValue: "Number of views" })}</p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {isSidebarLoading ? "..." : activeJobStats.views}
                      </p>
                    </li>
                    <li className="rounded-xl bg-slate-50 p-2 text-xs text-slate-700">
                      <p className="text-slate-500">{t("workspace.numberOfApplicants", { defaultValue: "Number of applicants" })}</p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {isSidebarLoading ? "..." : activeJobStats.applicants}
                      </p>
                    </li>
                  </ul>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">{t("workspace.nearbyCandidates", { defaultValue: "Nearby Candidates" })}</h3>
                  <ul className="mt-3 space-y-2">
                    {nearbyCandidates.map((candidate) => (
                      <li
                        key={candidate._id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-xs"
                      >
                        <span className="font-semibold text-slate-800">{candidate.name}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                          {candidate.trustScore || 0}
                        </span>
                      </li>
                    ))}
                    {!nearbyCandidates.length ? (
                      <li className="wc-nav-label text-xs text-slate-500">{t("workspace.noNearbyCandidates", { defaultValue: "No active candidates nearby." })}</li>
                    ) : null}
                  </ul>
                </section>
              </>
            ) : (
              <>
                <section
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                >
                  <h3
                    className="sticky top-0 z-10 inline-flex w-full items-center gap-2 bg-white pb-2 text-sm font-bold text-slate-900"
                  >
                    {t("workspace.suggested", { defaultValue: "Suggested Opportunities" })}
                  </h3>
                  <div className="max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-indigo-200">
                  <ul className="mt-1 space-y-2">
                    {suggestedJobs.map((job) => (
                      <li
                        key={job._id}
                        className="rounded-2xl border border-slate-200 bg-white p-3 text-[12px] text-slate-700 shadow-sm"
                        style={
                          containsKhmer(`${job.title || ""} ${job.location?.address || ""}`)
                            ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                            : undefined
                        }
                      >
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{job.title}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                          {job.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
                        </p>
                        <div className="mt-2 flex items-center gap-2.5">
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                            {job.salary || t("jobCard.negotiable", { defaultValue: "Negotiable" })}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                            <FaStar size={10} className="text-indigo-500" />
                            <span>{Number(job.__matchScore || 0)}% match</span>
                          </span>
                        </div>
                      </li>
                    ))}
                    {!suggestedJobs.length ? (
                      <li
                        className="wc-nav-label text-[12px] text-slate-500"
                      >
                        {t("workspace.noSuggestions", { defaultValue: "No suggestions yet." })}
                      </li>
                    ) : null}
                  </ul>
                  </div>
                </section>

                <section
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                >
                  <h3 className="text-sm font-bold text-slate-900">{t("workspace.topEarners", { defaultValue: "Top Rated Earners" })}</h3>
                  <ul className="mt-3 space-y-2">
                    {topEarners.map((earner) => {
                      const isCurrentUserEarner =
                        String(earner?._id || "") === String(user?._id || user?.id || "") ||
                        String(earner?.name || "").trim().toLowerCase() ===
                          String(user?.name || "").trim().toLowerCase();
                      const earnerAvatarSrc = resolveImageUrl(
                        earner?.photoUrl ||
                          earner?.profilePicture ||
                          (isCurrentUserEarner ? userAvatarUrl || user?.profilePicture || "" : ""),
                        imageBaseUrl
                      ) || DEFAULT_AVATAR_SVG;
                      return (
                      <li key={earner._id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2.5 text-[12px] shadow-sm">
                        <div className="flex items-center gap-3">
                          <img
                            src={earnerAvatarSrc}
                            alt={earner.name || "User"}
                            className="h-10 w-10 rounded-full border border-gray-100 object-cover"
                            loading="lazy"
                          />
                          <span
                            className="text-sm font-semibold text-slate-800"
                            style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                          >
                            {earner.name}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-700">
                          <FaStar size={10} className="text-violet-500" />
                          <span>{earner.trustScore || 0}</span>
                        </span>
                      </li>
                      );
                    })}
                    {!topEarners.length ? (
                      <li className="wc-nav-label text-[12px] text-slate-500">{t("workspace.noTrustData", { defaultValue: "No trust data available." })}</li>
                    ) : null}
                  </ul>
                </section>
              </>
            )}

            <section
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <h3 className="text-sm font-bold text-slate-900">{t("profile.trustGauge", { defaultValue: "Trust Score" })}</h3>
              <div className="mt-4 flex flex-col items-center">
                <div className="relative h-[82px] w-[132px] overflow-hidden">
                  <svg viewBox="0 0 140 80" className="h-full w-full">
                    <defs>
                      <linearGradient id="trustGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4F46E5" />
                        <stop offset="100%" stopColor="#7C3AED" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 16 64 A 54 54 0 0 1 124 64"
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <motion.path
                      d="M 16 64 A 54 54 0 0 1 124 64"
                      fill="none"
                      stroke="url(#trustGaugeGradient)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={gaugeCircumference}
                      initial={{ strokeDashoffset: gaugeCircumference }}
                      animate={{ strokeDashoffset: gaugeCircumference * (1 - gaugeProgress) }}
                      transition={{ duration: 1.1, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-x-0 bottom-[-2px] flex flex-col items-center">
                    <span className="mb-1 text-[2rem] font-black leading-none text-primary">{animatedTrustScore}</span>
                    <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Reliability Level
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>

      <nav className="wc-nav-surface fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/90 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {mobileNav.map((item) => {
            const isActive = isEmployer
              ? (() => {
                  const tab = new URLSearchParams(location.search).get("tab");
                  if (item.key === "dashboard") {
                    return location.pathname === "/workspace" && tab !== "listings";
                  }
                  if (item.key === "listings") {
                    return location.pathname === "/workspace" && tab === "listings";
                  }
                  return location.pathname === item.to;
                })()
              : location.pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link to={item.to}>
                  <motion.span
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.08 }}
                    className={`flex h-12 flex-col items-center justify-center rounded-xl text-xs font-semibold ${
                      isActive ? "bg-indigo-50 text-primary" : "text-slate-600"
                    }`}
                  >
                    <Icon size={20} className={isActive ? "text-primary" : "text-slate-500"} />
                    <span className="wc-nav-label mt-0.5 block">{item.label}</span>
                  </motion.span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default MainLayout;
