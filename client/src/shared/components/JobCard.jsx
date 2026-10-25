import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import {
  FaBookmark,
  FaBriefcase,
  FaCheckCircle,
  FaClock,
  FaGlobeAmericas,
  FaHome,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaShareAlt,
} from "react-icons/fa/index.js";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import LazyAvatar from "./LazyAvatar.jsx";
import {
  getMatchedSkills,
  getTopSkills,
  toSkillKey,
} from "../utils/skills.js";
import { toastError, toastSuccess } from "../utils/toast.jsx";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const formatPostedTime = (createdAt) => {
  if (!createdAt) return "Just now";
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

function JobCard({ job, index = 0 }) {
  const { t, i18n } = useTranslation();
  const { user, token, refreshCurrentUser } = useAuth();
  const isEmployer = user?.role === "employer";
  const currentUserId = String(user?.id || user?._id || "");
  const isOwnJob =
    String(job?.companyId || "") === currentUserId ||
    String(job?.employerId?._id || job?.employerId || "") === currentUserId;
  const [saved, setSaved] = useState(
    Array.isArray(user?.savedJobs) ? user.savedJobs.includes(String(job?._id || "")) : false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");

  useEffect(() => {
    if (Array.isArray(user?.savedJobs)) {
      setSaved(user.savedJobs.includes(String(job?._id || "")));
    }
  }, [job?._id, user?.savedJobs]);

  const companyName =
    job?.companyProfile?.companyName || job?.employerId?.companyName || job?.employerId?.name || "Independent Employer";
  const employerProfileId =
    job?.companyId ||
    job?.employerId?._id ||
    job?.employerId?.id ||
    null;
  const postedTime = formatPostedTime(job.createdAt);
  const isVerified = Number(job?.employerId?.trustScore || 0) >= 80;
  const activeLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const imageBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    return apiBase.replace(/\/api\/?$/, "");
  }, []);
  const companyLogoSrc = useMemo(() => {
    const raw = String(job?.companyProfile?.companyLogo || job?.employerId?.companyLogo || "").trim();
    if (!raw) {
      return "";
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
    }
    return `${imageBaseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }, [imageBaseUrl, job?.companyProfile?.companyLogo, job?.employerId?.companyLogo]);

  const previewMapUrl = useMemo(() => {
    const lat = Number(job?.location?.lat);
    const lng = Number(job?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !MAPS_KEY) {
      return "";
    }

    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=600x260&markers=color:0x4F46E5|${lat},${lng}&style=feature:all|element:labels|visibility:off&key=${MAPS_KEY}`;
  }, [job?.location?.lat, job?.location?.lng]);

  const mapDeepLink = useMemo(() => {
    const lat = Number(job?.location?.lat);
    const lng = Number(job?.location?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    const address = String(job?.location?.address || "").trim();
    if (address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return "";
  }, [job?.location?.address, job?.location?.lat, job?.location?.lng]);
  const requiredSkillPool = useMemo(() => {
    if (Array.isArray(job?.requiredSkills)) {
      return job.requiredSkills;
    }
    if (Array.isArray(job?.requirements)) {
      return job.requirements;
    }
    return [];
  }, [job?.requiredSkills, job?.requirements]);
  const topRequiredSkills = useMemo(() => getTopSkills(requiredSkillPool, 3), [requiredSkillPool]);
  const matchedSkills = useMemo(
    () => getMatchedSkills(user?.skills, requiredSkillPool),
    [requiredSkillPool, user?.skills]
  );
  const preferredCategoryKeys = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(Array.isArray(user?.preferredCategories) ? user.preferredCategories : []),
            user?.preferredCategory,
          ]
            .map((entry) => toSkillKey(String(entry || "").trim()))
            .filter(Boolean)
        )
      ),
    [user?.preferredCategories, user?.preferredCategory]
  );
  const hasCategoryMatch =
    preferredCategoryKeys.length > 0 &&
    preferredCategoryKeys.includes(toSkillKey(String(job?.category || "")));
  const hasSkillMatch = matchedSkills.length > 0;
  const isRemoteJob =
    (typeof job?.isRemote === "boolean" && job.isRemote) ||
    (typeof job?.is_remote === "boolean" && job.is_remote) ||
    (typeof job?.remote === "boolean" && job.remote) ||
    String(job?.tier_level || "").toLowerCase() === "remote" ||
    String(job?.workMode || "").toLowerCase() === "remote";
  const minExpRaw = Number(job?.minExperience ?? job?.min_experience);
  const hasMinExp = Number.isFinite(minExpRaw);
  const expLevelRaw = String(job?.experienceLevel || "").toLowerCase();
  const tierLevelRaw = String(job?.tier_level || "").toLowerCase();
  const tierKey = isRemoteJob
    ? "remote"
    : tierLevelRaw === "no_experience" ||
      expLevelRaw === "entry" ||
      expLevelRaw.includes("intern") ||
      (hasMinExp && minExpRaw <= 0)
      ? "no_experience"
      : tierLevelRaw === "senior" || expLevelRaw === "senior" || (hasMinExp && minExpRaw > 2)
        ? "senior"
        : "junior";
  const tierLabel =
    tierKey === "remote"
      ? t("jobCard.remote", { defaultValue: "Remote" })
      : tierKey === "no_experience"
        ? t("jobCard.experienceNoExp", { defaultValue: "No Experience" })
        : tierKey === "senior"
          ? t("jobCard.experienceSenior", { defaultValue: "Senior" })
          : t("jobCard.experienceJunior", { defaultValue: "Junior" });
  const tierClass =
    tierKey === "remote"
      ? "border-indigo-600 bg-[#4F46E5] text-white"
      : tierKey === "no_experience"
        ? "border-emerald-100 bg-emerald-100 text-emerald-700"
        : tierKey === "senior"
          ? "border-slate-200 bg-slate-100 text-slate-700"
          : "border-purple-100 bg-purple-100 text-purple-700";

  const handleSaveToggle = async () => {
    try {
      if (!token) {
        toastError("Please login to save jobs");
        return;
      }

      setIsSaving(true);
      const response = await fetch(`${API_BASE_URL}/jobs/${job._id}/save`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save job");
      }

      setSaved(Boolean(data.saved));
      await refreshCurrentUser();
      if (data.saved) {
        toastSuccess(t("jobCard.savedSuccess", { defaultValue: "Job saved to your collection!" }));
      } else {
        toastError(t("jobCard.removedSaved", { defaultValue: "Removed from saved jobs" }));
      }
    } catch (error) {
      toastError(error.message || "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/jobs/${job._id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: job.title || "Job Opportunity",
          text: `${companyName} - ${job.title}`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      toastSuccess(t("jobCard.linkCopied", { defaultValue: "Link copied to clipboard" }));
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      toastError("Could not share this job");
    }
  };

  const handleCommentSubmit = (event) => {
    event.preventDefault();
    if (!commentInput.trim()) return;
    setComments((prev) => [...prev, commentInput.trim()]);
    setCommentInput("");
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04 }}
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
        activeLanguage === "km" ? "wc-feed-text" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        {employerProfileId ? (
          <Link to={`/employers/${employerProfileId}`} className="flex min-w-0 flex-1 items-center gap-3">
            <LazyAvatar
              src={companyLogoSrc}
              alt={companyName}
              name={companyName}
              className="h-10 w-10 rounded-full border border-slate-200 bg-white"
              textClassName="text-xs"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className="truncate">{companyName}</span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
                    <FaCheckCircle size={14} />
                    <span>{t("jobCard.verified", { defaultValue: "Verified" })}</span>
                  </span>
                ) : null}
              </p>
              <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                <FaClock size={14} className="text-slate-500" />
                <span>{postedTime}</span>
                <span>&middot;</span>
                <FaGlobeAmericas size={14} className="text-slate-500" />
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <LazyAvatar
              src={companyLogoSrc}
              alt={companyName}
              name={companyName}
              className="h-10 w-10 rounded-full border border-slate-200 bg-white"
              textClassName="text-xs"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className="truncate">{companyName}</span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm">
                    <FaCheckCircle size={14} />
                    <span>{t("jobCard.verified", { defaultValue: "Verified" })}</span>
                  </span>
                ) : null}
              </p>
              <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                <FaClock size={14} className="text-slate-500" />
                <span>{postedTime}</span>
                <span>&middot;</span>
                <FaGlobeAmericas size={14} className="text-slate-500" />
              </p>
            </div>
          </div>
        )}
        <div className="flex shrink-0 items-start pt-0.5">
          {hasSkillMatch ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <FaCheckCircle size={11} />
              <span className="whitespace-nowrap">
                {t("jobCard.match", { defaultValue: "Best Match" })}
              </span>
            </span>
          ) : null}
        </div>
      </header>

      <div className="space-y-2.5 px-4 pb-3 pt-3">
        <h3
          className="text-xl font-bold leading-snug text-indigo-600 sm:text-2xl"
          style={{
            fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
            fontWeight: 700,
          }}
        >
          {job.title}
        </h3>
        {job?.description ? (
          <p className="line-clamp-3 text-sm text-slate-700">{job.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1">
            <FaMapMarkerAlt size={12} className="text-slate-500" />
            <span className="max-w-[220px] truncate sm:max-w-[320px]">
              {job.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {job?.salary ? (
            <p
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm"
              style={
                activeLanguage === "km"
                  ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif", lineHeight: 1.6 }
                  : undefined
              }
            >
              <span className="text-emerald-800">
                {String(job.salary).includes("$") ? job.salary : `$${job.salary}`}
              </span>
            </p>
          ) : null}
          {job?.category ? (
            <p
              className={`inline-flex items-center gap-1 rounded-full border border-purple-100 px-2 py-1 text-xs font-semibold ${
              hasCategoryMatch ? "bg-purple-100 text-purple-700" : "bg-purple-50 text-purple-700"
              }`}
              style={
                activeLanguage === "km"
                  ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                  : undefined
              }
            >
              <FaBriefcase size={12} className="text-indigo-600" />
              <span>
                {t(`categories.${toSkillKey(job.category)}`, { defaultValue: job.category })}
              </span>
            </p>
          ) : null}
          <p
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${tierClass}`}
            style={
              activeLanguage === "km"
                ? {
                    fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
                    lineHeight: 1.6,
                    fontWeight: 700,
                  }
                : tierKey === "remote"
                  ? { fontWeight: 700 }
                  : undefined
            }
          >
            {tierKey === "remote" ? <FaHome size={12} className="text-white" /> : null}
            <span>{tierLabel}</span>
          </p>
        </div>
        {topRequiredSkills.length ? (
          <div className="relative pt-1">
            <div className="flex flex-wrap gap-1.5">
              {topRequiredSkills.map((skill) => {
                return (
                  <span
                    key={`${job?._id}-skill-${skill}`}
                    className={`rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 whitespace-nowrap ${activeLanguage === "km" ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]" : ""}`}
                  >
                    {t(`skills.${toSkillKey(skill)}`, { defaultValue: skill })}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-y border-slate-100 bg-slate-50">
        {previewMapUrl ? (
          mapDeepLink ? (
            <a href={mapDeepLink} target="_blank" rel="noreferrer">
              <img
                src={previewMapUrl}
                alt={job.location?.address || "Map preview"}
                loading="lazy"
                decoding="async"
                className="h-40 w-full object-cover sm:h-44"
              />
            </a>
          ) : (
            <img
              src={previewMapUrl}
              alt={job.location?.address || "Map preview"}
              loading="lazy"
              decoding="async"
              className="h-40 w-full object-cover sm:h-44"
            />
          )
        ) : (
          <div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-500 sm:h-44">
            {t("jobCard.mapPreviewUnavailable", { defaultValue: "Map preview unavailable" })}
          </div>
        )}
      </div>

      <div
        className={`grid gap-1 border-b border-slate-100 bg-white px-2 py-1.5 ${
          isEmployer ? (isOwnJob ? "grid-cols-2" : "grid-cols-3") : "grid-cols-4"
        }`}
      >
        {isEmployer ? (
          <Link
            to={`/jobs/${job._id}`}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-100 sm:text-sm"
          >
            <FaBriefcase size={16} className="text-slate-500" />
            <span>{t("jobCard.manage", { defaultValue: "Manage" })}</span>
          </Link>
        ) : (
          <Link
            to={`/jobs/${job._id}`}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-100 sm:text-sm"
          >
            <FaPaperPlane size={16} className="text-slate-500" />
            <span className="sm:hidden">{t("nav.apply", { defaultValue: "Apply" })}</span>
            <span className="hidden sm:inline">
              {t("jobDetails.apply", { defaultValue: "Apply to this Job" })}
            </span>
          </Link>
        )}

        {!isOwnJob ? (
          <button
            type="button"
            onClick={handleSaveToggle}
            disabled={isSaving}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition duration-200 hover:bg-slate-100 disabled:opacity-60 sm:text-sm ${
              saved ? "text-primary" : "text-slate-700"
            }`}
          >
            <motion.span animate={{ scale: saved ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.2 }}>
              <FaBookmark size={16} className={saved ? "text-primary" : "text-slate-500"} />
            </motion.span>
            <span>{saved ? t("jobCard.saved", { defaultValue: "Saved" }) : t("jobCard.save", { defaultValue: "Save" })}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleShare}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-100 sm:text-sm"
        >
          <FaShareAlt size={16} className="text-slate-500" />
          <span>{t("jobCard.share", { defaultValue: "Share" })}</span>
        </button>
        {!isEmployer ? (
          <Link
            to={`/jobs/${job._id}`}
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-100 sm:text-sm"
          >
            <Eye size={16} className="text-slate-500" />
            <span>{t("jobCard.view", { defaultValue: "View" })}</span>
          </Link>
        ) : null}
      </div>

      <div className="px-3 pb-3 pt-2">
        {comments.length ? (
          <ul className="mb-2 space-y-1">
            {comments.map((comment, idx) => (
              <li key={`${job._id}-${idx}`} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
                {comment}
              </li>
            ))}
          </ul>
        ) : null}

        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={commentInput}
            onChange={(event) => setCommentInput(event.target.value)}
            placeholder={t("jobCard.askQuestion", { defaultValue: "Ask a public question..." })}
            className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:bg-white"
          />
          <button
            type="submit"
            className="h-10 rounded-full bg-primary px-4 text-xs font-bold text-white"
          >
            {t("jobCard.post", { defaultValue: "Post" })}
          </button>
        </form>
      </div>
    </motion.article>
  );
}

export default JobCard;

