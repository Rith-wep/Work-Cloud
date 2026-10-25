import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaFilePdf, FaSpinner } from "react-icons/fa/index.js";
import { Banknote, MapPin, ShieldCheck, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import CvPreviewModal from "../../shared/components/CvPreviewModal.jsx";
import LazyAvatar from "../../shared/components/LazyAvatar.jsx";
import { ListSkeleton } from "../../shared/components/PageSkeleton.jsx";
import { useAuth } from "../../shared/context/AuthContext.jsx";

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

const getTrustMeta = (score) => {
  const value = Number(score || 0);
  const normalized = Math.max(0, Math.min(100, value));
  if (normalized >= 80) {
    return { level: "Gold", color: "#10b981", progress: normalized };
  }
  if (normalized >= 40) {
    return { level: "Silver", color: "#2563eb", progress: normalized };
  }
  return { level: "Bronze", color: "#4f46e5", progress: normalized };
};

const getInterviewStartAt = (interviewDate, interviewTime) => {
  const normalizedDate = String(interviewDate || "").trim();
  const normalizedTime = String(interviewTime || "").trim();
  if (!normalizedDate || !normalizedTime) {
    return null;
  }
  const value = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const formatInterviewDateTime = (interviewDate, interviewTime) => {
  const startAt = getInterviewStartAt(interviewDate, interviewTime);
  if (!startAt) {
    return "";
  }
  return startAt.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getCountdownLabel = (interviewDate, interviewTime) => {
  const startAt = getInterviewStartAt(interviewDate, interviewTime);
  if (!startAt) {
    return "";
  }
  const diffMs = startAt.getTime() - Date.now();
  if (diffMs <= 0) {
    return "Starting now";
  }
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${Math.max(1, minutes)}m remaining`;
};

const buildCalendarUrl = ({ title, interviewDate, interviewTime, meetingLink, location }) => {
  const startAt = getInterviewStartAt(interviewDate, interviewTime);
  if (!startAt) {
    return "";
  }
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  const formatGoogleDate = (value) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const details = [meetingLink ? `Meeting Link: ${meetingLink}` : "", location ? `Location: ${location}` : ""]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Interview",
    dates: `${formatGoogleDate(startAt)}/${formatGoogleDate(endAt)}`,
    details,
    location: meetingLink || location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

function ApplyPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tRef = useRef(t);
  const { token, user, refreshCurrentUser } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeHandshakeId, setActiveHandshakeId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [, setNowTick] = useState(Date.now());
  const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);
  const [isCvPreviewLoading, setIsCvPreviewLoading] = useState(false);
  const [activeCvSnapshot, setActiveCvSnapshot] = useState(null);
  const imageBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(
    /\/api\/?$/,
    ""
  );
  const timelineSteps = useMemo(
    () => [
      { key: "pending", label: t("apply.timeline.applied", { defaultValue: "Applied" }) },
      { key: "contracted", label: t("apply.timeline.contracted", { defaultValue: "Contracted" }) },
      {
        key: "awaiting_confirmation",
        label: t("apply.timeline.arrived", { defaultValue: "Arrived" }),
      },
      { key: "completed", label: t("apply.timeline.completed", { defaultValue: "Completed" }) },
    ],
    [t]
  );
  const statusLabelMap = useMemo(
    () => ({
      pending: t("apply.statusValues.pending", { defaultValue: "Pending" }),
      accepted: t("apply.statusValues.accepted", { defaultValue: "Accepted" }),
      contracted: t("apply.statusValues.contracted", { defaultValue: "Contracted" }),
      awaiting_confirmation: t("apply.statusValues.awaiting_confirmation", {
        defaultValue: "Awaiting Confirmation",
      }),
      rejected: t("apply.statusValues.rejected", { defaultValue: "Rejected" }),
      no_show: t("apply.statusValues.no_show", { defaultValue: "No-show" }),
      completed: t("apply.statusValues.completed", { defaultValue: "Completed" }),
    }),
    [t]
  );
  const getTimelineProgress = (status) => {
    const normalized = status === "accepted" ? "contracted" : status;
    const idx = timelineSteps.findIndex((step) => step.key === normalized);
    return idx >= 0 ? idx : -1;
  };
  const formatSalary = (value) => {
    const raw = String(value || "").trim();
    if (!raw) {
      return t("apply.salaryNotListed");
    }
    if (/[$€£¥៛]/.test(raw)) {
      return raw;
    }
    const numeric = Number(raw.replace(/[^\d.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      return `$${numeric.toLocaleString()}`;
    }
    return raw;
  };
  const trustScore = Number(user?.trustScore ?? 0);
  const trustMeta = getTrustMeta(trustScore);
  const highlightedApplicationId = String(searchParams.get("highlightApp") || "").trim();

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchMyApplications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/applications/candidate`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            tRef.current("apply.failedFetchApplications", {
              defaultValue: "Failed to fetch applications",
            })
        );
      }

      setApplications(data.applications || []);
      await refreshCurrentUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [refreshCurrentUser, token]);

  useEffect(() => {
    fetchMyApplications();

    const refreshInterval = window.setInterval(fetchMyApplications, 15000);
    return () => window.clearInterval(refreshInterval);
  }, [fetchMyApplications]);

  useEffect(() => {
    const countdownTimer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => window.clearInterval(countdownTimer);
  }, []);

  useEffect(() => {
    if (!highlightedApplicationId || isLoading) {
      return;
    }
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`application-card-${highlightedApplicationId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlightedApplicationId, isLoading]);

  const handleArrived = async (application) => {
    setError("");
    setSuccessMessage("");
    const applicationId = application?._id || "";
    setActiveHandshakeId(applicationId);

    try {
      const isRemoteJob =
        Boolean(application?.jobId?.isRemote) ||
        Boolean(application?.jobId?.is_remote) ||
        String(application?.jobId?.jobType || "").toLowerCase() === "remote";
      let payload = {};

      if (!isRemoteJob) {
        if (!navigator.geolocation) {
          throw new Error(t("apply.geolocationUnsupported"));
        }

        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
          });
        });

        payload = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }

      const response = await fetch(`${API_BASE_URL}/applications/${applicationId}/handshake`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("apply.handshakeFailed"));
      }

      setApplications((prev) =>
        prev.map((application) =>
          application._id === applicationId
            ? {
                ...application,
                status: "awaiting_confirmation",
                handshakeCompleted: false,
              }
            : application
        )
      );

      setSuccessMessage(
        isRemoteJob
          ? t("apply.remoteSubmitted", {
              defaultValue: "Remote start confirmed. Waiting for employer confirmation.",
            })
          : t("apply.arrivalSubmitted", {
              defaultValue: "Arrival submitted. Waiting for employer confirmation.",
            })
      );

      const meetingLink = String(application?.interviewDetails?.meetingLink || "").trim();
      if (isRemoteJob && meetingLink) {
        window.open(meetingLink, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActiveHandshakeId("");
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  const handleOpenCvPreview = async (application) => {
    try {
      setIsCvPreviewLoading(true);
      const rawPath = String(application?.cvSnapshotUrl || "").trim();
      const snapshotPath = rawPath.startsWith("/api/")
        ? rawPath
        : `/api/applications/${application?._id}/cv-snapshot`;
      const response = await fetch(`${API_BASE_URL.replace(/\/api\/?$/, "")}${snapshotPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to load CV snapshot");
      }
      setActiveCvSnapshot(data.cvSnapshot || null);
      setIsCvPreviewOpen(true);
    } catch (err) {
      setError(err.message || "Failed to load CV snapshot");
    } finally {
      setIsCvPreviewLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-indigo-600">{t("apply.title")}</h1>
        <p className="text-sm text-slate-500">
          {t("apply.subtitle")}
        </p>
      </header>

      <AnimatePresence>
        {successMessage ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
          >
            {successMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div
              className="grid h-12 w-12 place-items-center rounded-full p-[3px]"
              style={{
              background: `conic-gradient(${trustMeta.color} ${trustMeta.progress * 3.6}deg, #E2E8F0 0deg)`,
              }}
            >
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-[11px] font-bold text-slate-700 [font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]">
              {trustScore}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t("apply.currentTrustScore")}</p>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold [font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
              style={{
                backgroundColor:
                  trustMeta.level === "Gold"
                    ? "#ECFDF5"
                    : trustMeta.level === "Silver"
                      ? "#EFF6FF"
                      : "#EEF2FF",
                color: trustMeta.color,
              }}
            >
              {t(`profile.levels.${trustMeta.level.toLowerCase()}`, {
                defaultValue: trustMeta.level,
              })}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : null}

      {!isLoading && !applications.length ? (
        <p className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
          {t("apply.noApplications")}
        </p>
      ) : null}

      {!isLoading && applications.length ? (
        <motion.div layout className="space-y-3">
          {applications.map((application) => (
            <motion.article
              key={application._id}
              id={`application-card-${application._id}`}
              layout
              whileHover={{ y: -4 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur-sm ${
                highlightedApplicationId === String(application._id)
                  ? "border-violet-300 ring-2 ring-violet-200 shadow-[0_0_28px_rgba(139,92,246,0.28)]"
                  : "border-slate-200"
              }`}
            >
              {(() => {
                const isRemoteJob =
                  Boolean(application?.jobId?.isRemote) ||
                  Boolean(application?.jobId?.is_remote) ||
                  String(application?.jobId?.jobType || "").toLowerCase() === "remote";
                const meetingLink = String(application?.interviewDetails?.meetingLink || "").trim();
                const scheduledLocation = String(application?.interviewDetails?.location || "").trim();
                const interviewDate = String(application?.interviewDetails?.interviewDate || "").trim();
                const interviewTime = String(application?.interviewDetails?.interviewTime || "").trim();
                const scheduledDateTime = formatInterviewDateTime(interviewDate, interviewTime);
                const countdownLabel = getCountdownLabel(interviewDate, interviewTime);
                const calendarUrl = buildCalendarUrl({
                  title: application.jobId?.title || "Interview",
                  interviewDate,
                  interviewTime,
                  meetingLink,
                  location: scheduledLocation,
                });
                const actionLabel = isRemoteJob
                  ? meetingLink
                    ? t("apply.joinRemoteInterview", { defaultValue: "Join Remote Interview" })
                    : t("apply.confirmRemoteStart", { defaultValue: "Confirm Remote Start" })
                  : t("apply.arrived");
                return (
                  <>
              <div className="mb-4">
                <div className="relative px-2">
                  <div className="absolute left-5 right-5 top-[7px] h-[2px] bg-indigo-200" />
                  <div className="relative grid grid-cols-4 gap-1">
                    {timelineSteps.map((step, idx) => {
                      const isDone = getTimelineProgress(application.status) >= idx;
                      return (
                        <div key={step.key} className="flex flex-col items-center text-center">
                          <span
                            className={`h-4 w-4 rounded-full border-2 border-white shadow-sm ${
                              isDone ? "bg-primary" : "bg-slate-300"
                            }`}
                          />
                          <span className="mt-2 text-[11px] font-semibold leading-tight text-slate-500">
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <LazyAvatar
                      src={
                        application.jobId?.employerId?.companyLogo
                          ? application.jobId.employerId.companyLogo.startsWith("http://") ||
                            application.jobId.employerId.companyLogo.startsWith("https://")
                            ? application.jobId.employerId.companyLogo
                            : `${imageBaseUrl}${application.jobId.employerId.companyLogo.startsWith("/") ? application.jobId.employerId.companyLogo : `/${application.jobId.employerId.companyLogo}`}`
                          : ""
                      }
                      alt={application.jobId?.employerId?.companyName || application.jobId?.employerId?.name || "Company"}
                      name={
                        application.jobId?.employerId?.companyName ||
                        application.jobId?.employerId?.name ||
                        t("apply.companyInitial", { defaultValue: "C" })
                      }
                      className="h-10 w-10 shrink-0"
                      textClassName="text-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {application.jobId?.employerId?.companyName ||
                          application.jobId?.employerId?.name ||
                          t("apply.company", { defaultValue: "Company" })}
                      </p>
                      {isRemoteJob ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                          <Video size={12} />
                          <span>{t("postJob.remote", { defaultValue: "Remote" })}</span>
                        </p>
                      ) : null}
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={12} />
                        <span>{application.jobId?.location?.address || t("jobCard.locationTbd")}</span>
                      </p>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-indigo-600">
                    {application.jobId?.title || t("jobDetails.job")}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-blue-500">
                    <Banknote size={14} />
                    <span>{formatSalary(application.jobId?.salary)}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {application.jobId?.location?.address || t("jobCard.locationTbd")}
                  </p>
                </div>

                <div className="space-y-3 md:min-w-[200px] md:text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {t("apply.status")}:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <motion.span
                      key={`${application._id}-${application.status}`}
                      initial={{ scale: 0.9, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                        statusPillClass[application.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <ShieldCheck size={12} />
                      <span>{statusLabelMap[application.status] || application.status}</span>
                    </motion.span>
                    <button
                      type="button"
                      onClick={() => handleOpenCvPreview(application)}
                      disabled={isCvPreviewLoading}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                    >
                      <FaFilePdf size={12} />
                      <span>{isCvPreviewLoading ? "Loading CV..." : "PDF Preview"}</span>
                    </button>

                    {["accepted", "contracted"].includes(application.status) ? (
                      <button
                        type="button"
                        onClick={() => handleArrived(application)}
                        disabled={
                          activeHandshakeId === application._id ||
                          application.status === "awaiting_confirmation" ||
                          application.status === "completed"
                        }
                        className="inline-flex h-10 w-full min-w-[160px] items-center justify-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition duration-200 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                      >
                        {activeHandshakeId === application._id ? (
                          <span className="inline-flex items-center gap-2">
                            <FaSpinner size={14} className="animate-spin" />
                            <span>{t("common.processing", { defaultValue: "Processing..." })}</span>
                          </span>
                        ) : (
                          actionLabel
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              {isRemoteJob && meetingLink ? (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  <span className="font-semibold">{t("apply.meetingLink", { defaultValue: "Meeting Link" })}: </span>
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline underline-offset-2"
                  >
                    {meetingLink}
                  </a>
                </div>
              ) : null}
              {scheduledDateTime ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      {t("apply.interviewScheduled", { defaultValue: "Interview Scheduled" })}
                    </span>
                    {countdownLabel ? (
                      <span className="text-xs font-semibold text-emerald-700">{countdownLabel}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-semibold">{scheduledDateTime}</p>
                  {!isRemoteJob && scheduledLocation ? (
                    <p className="mt-1 text-xs text-emerald-700">
                      {t("apply.interviewLocation", { defaultValue: "Location" })}: {scheduledLocation}
                    </p>
                  ) : null}
                  {calendarUrl ? (
                    <a
                      href={calendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      {t("apply.addToCalendar", { defaultValue: "Add to Calendar" })}
                    </a>
                  ) : null}
                </div>
              ) : null}
                  </>
                );
              })()}
            </motion.article>
          ))}
        </motion.div>
      ) : null}

      <CvPreviewModal
        isOpen={isCvPreviewOpen}
        title="CV Snapshot Preview"
        data={activeCvSnapshot}
        onClose={() => {
          setIsCvPreviewOpen(false);
          setActiveCvSnapshot(null);
        }}
      />
    </section>
  );
}

export default ApplyPage;

