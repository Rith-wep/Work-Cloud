import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArchive,
  FaCheck,
  FaCheckCircle,
  FaEdit,
  FaHistory,
  FaPhoneAlt,
  FaSave,
  FaSpinner,
  FaStar,
  FaTelegramPlane,
  FaTimes,
  FaTrash,
  FaVideo,
} from "react-icons/fa/index.js";

import ConfirmationModal from "../../shared/components/ConfirmationModal.jsx";
import LazyAvatar from "../../shared/components/LazyAvatar.jsx";
import SkeletonProfile from "../../shared/components/SkeletonProfile.jsx";
import { useAuth } from "../../shared/context/AuthContext.jsx";
import { toastError, toastSuccess } from "../../shared/utils/toast.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const statusPillClass = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  contracted: "bg-primary/15 text-primary",
  awaiting_confirmation: "bg-blue-100 text-blue-700",
  rejected: "bg-rose-100 text-rose-700",
  no_show: "bg-rose-200 text-rose-800",
  completed: "bg-indigo-100 text-indigo-700",
};

const trustBadgeClass = (score) => {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

const successBadgeClass = (rate) => {
  if (rate >= 80) return "bg-emerald-100 text-emerald-700";
  if (rate >= 50) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

function ManageApplications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, token, refreshCurrentUser } = useAuth();
  const [applications, setApplications] = useState([]);
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState({ activeJobs: 0, filledJobs: 0, totalJobs: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isListingsLoading, setIsListingsLoading] = useState(true);
  const [error, setError] = useState("");
  const [listingsError, setListingsError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [managingJobId, setManagingJobId] = useState("");
  const urlTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    ["applications", "settings", "listings"].includes(urlTab) ? urlTab : "applications"
  );
  const highlightedApplicationId = String(searchParams.get("highlightApp") || "").trim();
  const highlightedJobId = String(searchParams.get("highlightJob") || "").trim();
  const [deleteConfirmJob, setDeleteConfirmJob] = useState(null);
  const [settings, setSettings] = useState({
    companyName: "",
    businessPhoneNumber: "",
    businessTelegramUsername: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [reviewForms, setReviewForms] = useState({});
  const [interviewForms, setInterviewForms] = useState({});
  const [reviewSubmittingId, setReviewSubmittingId] = useState("");
  const imageBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    return apiBase.replace(/\/api\/?$/, "");
  }, []);
  const minInterviewDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const fetchApplications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/applications/employer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch applications");
      }

      setApplications(data.applications || []);
      setSettings((prev) => ({
        companyName: data.companySettings?.companyName || prev.companyName,
        businessPhoneNumber:
          data.companySettings?.businessPhoneNumber || prev.businessPhoneNumber,
        businessTelegramUsername:
          data.companySettings?.businessTelegramUsername || prev.businessTelegramUsername,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const fetchMyListings = useCallback(async () => {
    try {
      setIsListingsLoading(true);
      setListingsError("");
      const response = await fetch(`${API_BASE_URL}/jobs/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch your listings");
      }
      const nextListings = data.jobs || [];
      setListings(nextListings);
      setSummary({
        totalJobs: nextListings.length,
        activeJobs: nextListings.filter((job) => job.status === "open").length,
        filledJobs: nextListings.filter((job) => job.isFilled).length,
      });
    } catch (err) {
      setListingsError(err.message);
    } finally {
      setIsListingsLoading(false);
    }
  }, [token]);

  const refreshWorkspaceData = useCallback(async () => {
    await Promise.all([fetchApplications(), fetchMyListings()]);
  }, [fetchApplications, fetchMyListings]);

  useEffect(() => {
    refreshWorkspaceData();
  }, [refreshWorkspaceData]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (["applications", "settings", "listings"].includes(nextTab) && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    if (!nextTab && activeTab !== "applications") {
      setActiveTab("applications");
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    if (isLoading && isListingsLoading) {
      return;
    }
    const targetId =
      activeTab === "listings" && highlightedJobId
        ? `listing-card-${highlightedJobId}`
        : highlightedApplicationId
          ? `application-card-${highlightedApplicationId}`
          : "";
    if (!targetId) {
      return;
    }
    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    highlightedApplicationId,
    highlightedJobId,
    isLoading,
    isListingsLoading,
  ]);

  const setTab = (tab) => {
    setActiveTab(tab);
    if (tab === "applications") {
      setSearchParams({});
      return;
    }
    setSearchParams({ tab });
  };

  const updateStatus = async (applicationId, status, applicationCompanyId) => {
    try {
      setUpdatingId(applicationId);
      setError("");
      const resolvedCompanyId =
        String(applicationCompanyId || "").trim() || String(user?._id || user?.id || "").trim();
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update application");
      }

      setApplications((prev) =>
        prev.map((application) =>
          application._id === applicationId
            ? { ...application, status: data.application?.status || status }
            : application
        )
      );
      await fetchMyListings();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  };

  const confirmArrival = async (applicationId) => {
    try {
      setUpdatingId(applicationId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/confirm-arrival`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to confirm candidate arrival");
      }
      await refreshWorkspaceData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  };

  const reportNoShow = async (applicationId) => {
    try {
      setUpdatingId(applicationId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/report-no-show`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to report no-show");
      }
      await refreshWorkspaceData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  };

  const handleReviewChange = (applicationId, key, value) => {
    setReviewForms((prev) => ({
      ...prev,
      [applicationId]: {
        ...prev[applicationId],
        [key]: value,
      },
    }));
  };

  const handleInterviewChange = (applicationId, key, value) => {
    setInterviewForms((prev) => ({
      ...prev,
      [applicationId]: {
        ...prev[applicationId],
        [key]: value,
      },
    }));
  };

  const saveInterviewDetails = async (application) => {
    try {
      setUpdatingId(application._id);
      setError("");
      const isRemoteJob =
        Boolean(application?.jobId?.isRemote) ||
        Boolean(application?.jobId?.is_remote) ||
        String(application?.jobId?.jobType || "").toLowerCase() === "remote";
      const draft = interviewForms[application._id] || {};
      const payload = isRemoteJob
        ? {
            meetingLink: draft.meetingLink ?? application?.interviewDetails?.meetingLink ?? "",
            interviewDate:
              draft.interviewDate ?? application?.interviewDetails?.interviewDate ?? "",
            interviewTime:
              draft.interviewTime ?? application?.interviewDetails?.interviewTime ?? "",
          }
        : {
            location: draft.location ?? application?.interviewDetails?.location ?? "",
            interviewDate:
              draft.interviewDate ?? application?.interviewDetails?.interviewDate ?? "",
            interviewTime:
              draft.interviewTime ?? application?.interviewDetails?.interviewTime ?? "",
          };

      const response = await fetch(`${API_BASE_URL}/applications/${application._id}/interview`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update interview details");
      }

      setApplications((prev) =>
        prev.map((entry) =>
          entry._id === application._id
            ? { ...entry, interviewDetails: data.application?.interviewDetails || payload }
            : entry
        )
      );
      toastSuccess("Interview details updated.");
    } catch (err) {
      setError(err.message);
      toastError(err.message);
    } finally {
      setUpdatingId("");
    }
  };

  const submitReview = async (application) => {
    try {
      setReviewSubmittingId(application._id);
      if (application.status !== "completed") {
        throw new Error("Review is available only when the application is completed");
      }

      const form = reviewForms[application._id] || {};
      const rating = Number(form.rating || application.myCompanyReview?.rating || 0);
      const comment = form.comment ?? application.myCompanyReview?.comment ?? "";
      if (!rating || rating < 1 || rating > 5) {
        throw new Error("Please select a rating between 1 and 5");
      }

      const response = await fetch(`${API_BASE_URL}/reviews/candidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationId: application._id,
          rating,
          comment,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to save review");
      }

      await fetchApplications();
      toastSuccess("Candidate reviewed! Trust Score updated.");
    } catch (err) {
      toastError(err.message);
      setError(err.message);
    } finally {
      setReviewSubmittingId("");
    }
  };

  const saveCompanySettings = async () => {
    try {
      setSavingSettings(true);
      setSettingsMessage("");
      setError("");
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update company settings");
      }

      await refreshCurrentUser();
      setSettingsMessage("Company settings updated.");
      setTimeout(() => setSettingsMessage(""), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const manageListingStatus = async (jobId, status) => {
    try {
      setManagingJobId(jobId);
      setListingsError("");
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update listing status");
      }
      await refreshWorkspaceData();
    } catch (err) {
      setListingsError(err.message);
    } finally {
      setManagingJobId("");
    }
  };

  const deleteListing = async (jobId) => {
    try {
      setManagingJobId(jobId);
      setListingsError("");
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete listing");
      }
      await refreshWorkspaceData();
    } catch (err) {
      setListingsError(err.message);
    } finally {
      setManagingJobId("");
    }
  };

  const confirmDeleteListing = async () => {
    if (!deleteConfirmJob?._id) {
      return;
    }
    await deleteListing(deleteConfirmJob._id);
    setDeleteConfirmJob(null);
  };

  const dashboardMetrics = useMemo(
    () => [
      { label: t("workspace.activeJobs", { defaultValue: "Active Jobs" }), value: summary.activeJobs || 0 },
      { label: t("workspace.filledJobs", { defaultValue: "Filled Jobs" }), value: summary.filledJobs || 0 },
      { label: t("workspace.totalJobs", { defaultValue: "Total Jobs" }), value: summary.totalJobs || 0 },
    ],
    [summary.activeJobs, summary.filledJobs, summary.totalJobs, t]
  );

  return (
    <section className="space-y-4">
      <header className="space-y-3">
        <h1 className="text-xl font-bold text-slate-900">{t("workspace.manageApplications", { defaultValue: "Manage Applications" })}</h1>
        <div className="grid grid-cols-3 gap-2">
          {dashboardMetrics.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-lg font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("applications")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              activeTab === "applications" ? "bg-white text-primary shadow-sm" : "text-slate-600"
            }`}
          >
            {t("workspace.applications", { defaultValue: "Applications" })}
          </button>
          <button
            type="button"
            onClick={() => setTab("settings")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              activeTab === "settings" ? "bg-white text-primary shadow-sm" : "text-slate-600"
            }`}
          >
            {t("workspace.companySettings", { defaultValue: "Company Settings" })}
          </button>
          <button
            type="button"
            onClick={() => setTab("listings")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              activeTab === "listings" ? "bg-white text-primary shadow-sm" : "text-slate-600"
            }`}
          >
            My Listings
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {activeTab === "settings" ? (
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">{t("workspace.businessContacts", { defaultValue: "Business Inquiry Contacts" })}</h2>
          <input
            type="text"
            value={settings.companyName}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, companyName: event.target.value }))
            }
            placeholder="Company Name"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            type="text"
            value={settings.businessPhoneNumber}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, businessPhoneNumber: event.target.value }))
            }
            placeholder="Business Phone"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            type="text"
            value={settings.businessTelegramUsername}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, businessTelegramUsername: event.target.value }))
            }
            placeholder="Business Telegram Username"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          {settingsMessage ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {settingsMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={saveCompanySettings}
            disabled={savingSettings}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FaSave size={14} />
            <span>{savingSettings ? t("common.saving", { defaultValue: "Saving..." }) : t("workspace.saveSettings", { defaultValue: "Save Settings" })}</span>
          </button>
        </article>
      ) : null}

      {activeTab === "applications" ? (
        <>
          {isLoading ? <p className="text-sm text-slate-500">{t("workspace.loadingApplications", { defaultValue: "Loading applications..." })}</p> : null}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <SkeletonProfile key={idx} />
              ))}
            </div>
          ) : null}

          {!isLoading && !applications.length ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              {t("workspace.noCandidatesYet", { defaultValue: "No candidates have applied yet." })}
            </p>
          ) : null}

          {!isLoading && applications.length ? (
            <motion.div layout className="space-y-3">
              <AnimatePresence initial={false}>
                {applications.map((application) => {
                  const candidate = application.candidateId || {};
                  const isRemoteJob =
                    Boolean(application?.jobId?.isRemote) ||
                    Boolean(application?.jobId?.is_remote) ||
                    String(application?.jobId?.jobType || "").toLowerCase() === "remote";
                  const candidateProfileId = candidate._id || candidate.id || "";
                  const candidatePicture = String(candidate.profilePicture || "").trim();
                  const candidatePictureUrl = candidatePicture
                    ? candidatePicture.startsWith("http://") || candidatePicture.startsWith("https://")
                      ? candidatePicture
                      : `${imageBaseUrl}${candidatePicture.startsWith("/") ? candidatePicture : `/${candidatePicture}`}`
                    : "";
                  const trustScore = Number(candidate.trustScore || 0);
                  const verifiedBadges = Array.isArray(candidate.verifiedBadges)
                    ? candidate.verifiedBadges
                    : [];
                  const verifiedApplications = Number(
                    candidate.verifiedApplicationsCount ||
                      (Array.isArray(candidate.history) ? candidate.history.length : 0)
                  );
                  const successRate = Number(application.candidateStats?.successRate || 0);
                  const acceptedApplications = Number(
                    application.candidateStats?.acceptedApplications || 0
                  );
                  const totalApplications = Number(
                    application.candidateStats?.totalApplications || 0
                  );
                  const isVerified = verifiedBadges.length > 0 || trustScore >= 100;

                  const phoneRaw = candidate.phoneNumber || "";
                  const telegramRaw = candidate.telegramUsername || "";
                  const normalizedPhone = String(phoneRaw).trim().replace(/[^\d+]/g, "");
                  const telegram = String(telegramRaw || "").trim().replace(/^@/, "");
                  const preferredMethod = String(candidate.preferredContactMethod || "").toLowerCase();
                  const prefersTelegram =
                    preferredMethod === "telegram" || (!normalizedPhone && !!telegram);
                  const hasTelegram = telegram.length > 0;
                  const hasPhone = normalizedPhone.length > 0;
                  const hasActiveContract = ["contracted", "awaiting_confirmation", "completed"].includes(
                    String(application.status || "").toLowerCase()
                  );
                  const canViewSensitiveContact = Boolean(application.canViewSensitiveContact);
                  const canQuickChat = prefersTelegram
                    ? hasActiveContract && canViewSensitiveContact && (hasTelegram || hasPhone)
                    : hasActiveContract && canViewSensitiveContact && (hasPhone || hasTelegram);
                  const quickChatHref = prefersTelegram
                    ? hasTelegram
                      ? `https://t.me/${encodeURIComponent(telegram)}`
                      : `tel:${encodeURIComponent(normalizedPhone)}`
                    : hasPhone
                      ? `tel:${encodeURIComponent(normalizedPhone)}`
                      : `https://t.me/${encodeURIComponent(telegram)}`;
                  const quickChatLabel = prefersTelegram
                    ? hasTelegram
                      ? "Quick Chat (Telegram)"
                      : "Quick Chat (Phone)"
                    : hasPhone
                      ? "Quick Chat (Phone)"
                      : "Quick Chat (Telegram)";
                  const isCompleted = application.status === "completed";
                  const isAwaitingConfirmation = application.status === "awaiting_confirmation";
                  const interviewForm = interviewForms[application._id] || {};
                  const interviewFieldValue = isRemoteJob
                    ? interviewForm.meetingLink ?? application?.interviewDetails?.meetingLink ?? ""
                    : interviewForm.location ?? application?.interviewDetails?.location ?? "";
                  const interviewDateValue =
                    interviewForm.interviewDate ?? application?.interviewDetails?.interviewDate ?? "";
                  const interviewTimeValue =
                    interviewForm.interviewTime ?? application?.interviewDetails?.interviewTime ?? "";
                  const interviewFieldLabel = isRemoteJob ? "Meeting Link" : "Location";
                  const reviewForm = reviewForms[application._id] || {};
                  const ratingDefault = application.myCompanyReview?.rating || "";
                  const commentDefault = application.myCompanyReview?.comment || "";

                  return (
                    <motion.article
                      key={application._id}
                      id={`application-card-${application._id}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`rounded-2xl border bg-white/80 p-6 shadow-sm backdrop-blur-lg ${
                        highlightedApplicationId === String(application._id)
                          ? "border-violet-300 ring-2 ring-violet-200 shadow-[0_0_28px_rgba(139,92,246,0.24)]"
                          : "border-slate-100"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {candidateProfileId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/candidates/${candidateProfileId}`)}
                              className="rounded-full p-0.5 transition hover:bg-slate-100"
                              title="View candidate profile"
                            >
                              <LazyAvatar
                                src={candidatePictureUrl}
                                alt={candidate.name || "Candidate"}
                                name={candidate.name || "N"}
                                className="mt-0.5 h-10 w-10"
                                textClassName="text-xs"
                              />
                            </button>
                          ) : (
                            <LazyAvatar
                              src={candidatePictureUrl}
                              alt={candidate.name || "Candidate"}
                              name={candidate.name || "N"}
                              className="mt-0.5 h-10 w-10"
                              textClassName="text-xs"
                            />
                          )}
                          <div>
                          <h3 className="text-base font-bold text-slate-900">
                            {application.jobId?.title || "Untitled Job"}
                          </h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                            <span>
                              Candidate:{" "}
                              {candidateProfileId ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/candidates/${candidateProfileId}`)}
                                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                                >
                                  {candidate.name || "Unknown"}
                                </button>
                              ) : (
                                <span className="font-semibold text-slate-800">
                                  {candidate.name || "Unknown"}
                                </span>
                              )}
                            </span>
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <FaCheckCircle size={12} />
                                <span>Verified</span>
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`rounded-full px-2.5 py-1 font-semibold ${trustBadgeClass(trustScore)}`}
                            >
                              Trust Score: {trustScore}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 font-semibold ${successBadgeClass(successRate)}`}>
                              {successRate}% Application Success Rate
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                              <FaHistory size={11} />
                              <span>Verified Applications: {verifiedApplications}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                              <FaStar size={11} className="text-amber-500" />
                              <span>
                                {application.candidateReviewSummary?.averageRating || 0}/5 (
                                {application.candidateReviewSummary?.totalReviews || 0} reviews)
                              </span>
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Accepted {acceptedApplications} of {totalApplications} applications
                          </p>
                          <p className="text-sm text-slate-500">{candidate.email || "No email"}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            {isRemoteJob ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                                <FaVideo size={11} />
                                <span>Remote applicant</span>
                              </span>
                            ) : null}
                            {candidateProfileId ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/candidates/${candidateProfileId}`)}
                                className="inline-flex items-center rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-600 transition duration-200 hover:bg-indigo-50"
                              >
                                View Profile
                              </button>
                            ) : null}
                            {application.jobId?._id ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/employer/applicants/${application.jobId._id}`)}
                                className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition duration-200 hover:bg-indigo-100"
                              >
                                View Professional CV
                              </button>
                            ) : null}
                          </div>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                            statusPillClass[application.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {application.status}
                        </span>
                      </div>

                      {application.candidateReviewsPreview?.length ? (
                        <div className="mt-2 rounded-xl bg-slate-50 p-2">
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            Community Reviews
                          </p>
                          <ul className="mt-1 space-y-1">
                            {application.candidateReviewsPreview.map((review) => (
                              <li key={review.id} className="text-xs text-slate-600">
                                <span className="font-semibold">{review.companyName}</span>:{" "}
                                {review.rating}/5 {review.comment ? `- ${review.comment}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Interview Scheduler
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                          <input
                            type={isRemoteJob ? "url" : "text"}
                            value={interviewFieldValue}
                            onChange={(event) =>
                              handleInterviewChange(
                                application._id,
                                isRemoteJob ? "meetingLink" : "location",
                                event.target.value
                              )
                            }
                            placeholder={interviewFieldLabel}
                            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            type="date"
                            min={minInterviewDate}
                            value={interviewDateValue}
                            onChange={(event) =>
                              handleInterviewChange(application._id, "interviewDate", event.target.value)
                            }
                            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <input
                            type="time"
                            value={interviewTimeValue}
                            onChange={(event) =>
                              handleInterviewChange(application._id, "interviewTime", event.target.value)
                            }
                            className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <button
                            type="button"
                            onClick={() => saveInterviewDetails(application)}
                            disabled={
                              updatingId === application._id ||
                              !String(interviewFieldValue || "").trim() ||
                              !String(interviewDateValue || "").trim() ||
                              !String(interviewTimeValue || "").trim()
                            }
                            className="inline-flex h-10 min-w-[96px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Save interview details"
                          >
                            {updatingId === application._id ? (
                              <FaSpinner size={12} className="animate-spin" />
                            ) : isRemoteJob ? (
                              <FaVideo size={12} />
                            ) : (
                              <FaSave size={12} />
                            )}
                            <span>Save</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-nowrap items-center gap-3 overflow-x-auto">
                        {canQuickChat ? (
                          <a
                            href={quickChatHref}
                            target={quickChatHref.startsWith("https://") ? "_blank" : undefined}
                            rel={quickChatHref.startsWith("https://") ? "noreferrer" : undefined}
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition duration-200 hover:bg-slate-100"
                          >
                            {quickChatLabel.includes("Telegram") ? (
                              <FaTelegramPlane size={14} />
                            ) : (
                              <FaPhoneAlt size={13} />
                            )}
                            <span>{quickChatLabel}</span>
                          </a>
                        ) : (
                          <span className="inline-flex shrink-0 items-center rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-500">
                            Quick contact unavailable
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              application._id,
                              "contracted",
                              application.companyId ||
                                application.jobId?.companyId ||
                                application.jobId?.employerId
                            )
                          }
                          disabled={
                            updatingId === application._id ||
                            application.status === "contracted" ||
                            isCompleted ||
                            isAwaitingConfirmation
                          }
                          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition duration-200 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === application._id ? (
                            <FaSpinner size={14} className="animate-spin" />
                          ) : (
                            <FaCheck size={16} />
                          )}
                          <span>
                            {updatingId === application._id
                              ? "Processing..."
                              : t("workspace.acceptContract", { defaultValue: "Accept & Contract" })}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              application._id,
                              "rejected",
                              application.companyId ||
                                application.jobId?.companyId ||
                                application.jobId?.employerId
                            )
                          }
                          disabled={
                            updatingId === application._id ||
                            application.status === "rejected" ||
                            isCompleted ||
                            isAwaitingConfirmation
                          }
                          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 transition duration-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FaTimes size={16} />
                          <span>{t("workspace.reject", { defaultValue: "Reject" })}</span>
                        </button>
                      </div>

                      {isAwaitingConfirmation ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => confirmArrival(application._id)}
                            disabled={updatingId === application._id}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingId === application._id ? (
                              <FaSpinner size={14} className="animate-spin" />
                            ) : (
                              <FaCheck size={16} />
                            )}
                            <span>
                              {updatingId === application._id
                                ? "Confirming..."
                                : isRemoteJob
                                  ? "Confirm Remote Start"
                                  : "Confirm Candidate Arrival"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => reportNoShow(application._id)}
                            disabled={updatingId === application._id}
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition duration-200 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FaTimes size={16} />
                            <span>Report No-Show</span>
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          RATE CANDIDATE: {String(candidate.name || "Candidate").toUpperCase()}
                        </p>
                        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                          <LazyAvatar
                            src={candidatePictureUrl}
                            alt={candidate.name || "Candidate"}
                            name={candidate.name || "N"}
                            className="h-8 w-8"
                            textClassName="text-xs"
                          />
                          <p className="text-xs text-slate-600">
                            {candidate.name || "Candidate"}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={reviewForm.rating ?? ratingDefault}
                            onChange={(event) =>
                              handleReviewChange(application._id, "rating", event.target.value)
                            }
                            disabled={!isCompleted}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          >
                            <option value="">Rate</option>
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <option key={rating} value={rating}>
                                {rating} Star
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={reviewForm.comment ?? commentDefault}
                            onChange={(event) =>
                              handleReviewChange(application._id, "comment", event.target.value)
                            }
                            placeholder="Review comment"
                            disabled={!isCompleted}
                            className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          />
                          <button
                            type="button"
                            onClick={() => submitReview(application)}
                            disabled={!isCompleted || reviewSubmittingId === application._id}
                            className="inline-flex h-10 items-center gap-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reviewSubmittingId === application._id ? (
                              <>
                                <FaSpinner size={12} className="animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <span>Save Review</span>
                            )}
                          </button>
                        </div>
                        {!isCompleted ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Review can be submitted only after status becomes COMPLETED.
                          </p>
                        ) : null}
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </>
      ) : null}

      {activeTab === "listings" ? (
        <section className="space-y-3">
          {listingsError ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{listingsError}</p>
          ) : null}
          {isListingsLoading ? (
            <p className="text-sm text-slate-500">Loading your listings...</p>
          ) : null}
          {!isListingsLoading && !listings.length ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              You have no listings yet.
            </p>
          ) : null}
          {!isListingsLoading && listings.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {listings.map((job) => (
                <article
                  key={job._id}
                  id={`listing-card-${job._id}`}
                  className={`flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm ${
                    highlightedJobId === String(job._id)
                      ? "border-violet-300 ring-2 ring-violet-200 shadow-[0_0_28px_rgba(139,92,246,0.24)]"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{job.location?.address || "Location TBD"}</p>
                      <p className="mt-1 text-sm font-semibold text-secondary">{job.salary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          job.status === "archived" || job.status === "closed"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {job.status === "archived" || job.status === "closed" ? "Archived" : "Active"}
                      </span>
                      {job.isFilled ? (
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-[11px] font-semibold text-purple-700">
                          Filled
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      Applicants: {Number(job.applicantsCount || 0)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      Hired: {Number(job.hiredCount || 0)} / {Number(job.vacancies || job.hiringLimit || 1)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      Remaining: {Number(job.remainingSpots ?? Math.max(0, Number(job.vacancies || job.hiringLimit || 1) - Number(job.hiredCount || 0)))}
                    </span>
                  </div>
                  <div className="mt-auto flex flex-wrap justify-center gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/jobs/${job._id}/edit`)}
                      disabled={managingJobId === job._id}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                    >
                      <FaEdit size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        manageListingStatus(
                          job._id,
                          job.status === "archived" || job.status === "closed" ? "open" : "archived"
                        )
                      }
                      disabled={managingJobId === job._id}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-50 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                    >
                      <FaArchive size={12} />
                      <span>
                        {job.status === "archived" || job.status === "closed"
                          ? "Reopen"
                          : "Stop/Archive"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmJob(job)}
                      disabled={managingJobId === job._id}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <FaTrash size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <ConfirmationModal
        isOpen={Boolean(deleteConfirmJob)}
        title="Delete Listing?"
        message="Are you sure? This will permanently remove this job and all its applications."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={Boolean(deleteConfirmJob && managingJobId === deleteConfirmJob._id)}
        onCancel={() => setDeleteConfirmJob(null)}
        onConfirm={confirmDeleteListing}
      />
    </section>
  );
}

export default ManageApplications;

