import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FaBookmark, FaMapMarkerAlt, FaShareAlt } from "react-icons/fa/index.js";

import { useAuth } from "../context/AuthContext.jsx";
import { ListSkeleton } from "../components/PageSkeleton.jsx";
import { toastError, toastSuccess } from "../utils/toast.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function SavedJobsPage() {
  const { t } = useTranslation();
  const { token, refreshCurrentUser } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSavedJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/jobs/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch saved jobs");
      }
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSavedJobs();
  }, [fetchSavedJobs]);

  const handleUnsave = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/save`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("saved.failedUpdate", { defaultValue: "Failed to update saved job" }));
      }

      setJobs((prev) => prev.filter((job) => job._id !== jobId));
      await refreshCurrentUser();
      toastError(t("jobCard.removedSaved", { defaultValue: "Removed from saved jobs" }));
    } catch (err) {
      toastError(err.message || t("common.actionFailed", { defaultValue: "Action failed" }));
    }
  };

  const handleShare = async (job) => {
    const url = `${window.location.origin}/jobs/${job._id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: job.title || "Job Opportunity",
          text: `${job.companyProfile?.companyName || t("common.company", { defaultValue: "Company" })} - ${job.title}`,
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
      toastError(t("saved.shareFailed", { defaultValue: "Could not share this job" }));
    }
  };

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-bold text-slate-900">
        {t("nav.savedJobs", { defaultValue: "Saved Jobs" })}
      </h1>

      {error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p> : null}

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : null}

      {!isLoading && !jobs.length ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          {t("saved.empty", {
            defaultValue: "No saved jobs yet. Tap Save on the feed to bookmark opportunities.",
          })}
        </article>
      ) : null}

      {!isLoading && jobs.length ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <article key={job._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Link to={`/jobs/${job._id}`} className="block">
                <h2 className="text-base font-bold text-slate-900">{job.title}</h2>
                <p className="mt-1 text-sm font-semibold text-secondary">{job.salary}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                  <FaMapMarkerAlt size={12} />
                  <span>{job.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}</span>
                </p>
              </Link>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleUnsave(job._id)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
                >
                  <FaBookmark size={16} />
                  <span>{t("saved.unsave", { defaultValue: "Unsave" })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShare(job)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  <FaShareAlt size={16} />
                  <span>{t("jobCard.share", { defaultValue: "Share" })}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default SavedJobsPage;
