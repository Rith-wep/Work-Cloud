import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../../shared/context/AuthContext.jsx";
import { ListSkeleton } from "../../shared/components/PageSkeleton.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function MyPostingsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMyJobs = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/jobs/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || t("postings.failedFetch", { defaultValue: "Failed to fetch your postings" }));
        }
        setJobs(data.jobs || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyJobs();
  }, [token]);

  const handleDelete = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
          throw new Error(data.message || t("postings.failedDelete", { defaultValue: "Failed to delete posting" }));
      }
      setJobs((prev) => prev.filter((job) => job._id !== jobId));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="space-y-3">
      <h1 className="text-xl font-bold text-slate-900">{t("postings.title", { defaultValue: "My Postings" })}</h1>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {isLoading ? <ListSkeleton count={4} /> : null}

      {!isLoading && !jobs.length ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {t("postings.empty", { defaultValue: "You have not posted any jobs yet." })}
        </p>
      ) : null}

      {!isLoading && jobs.length ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <article key={job._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Link to={`/jobs/${job._id}`} className="text-base font-bold text-slate-900 hover:text-primary">
                {job.title}
              </Link>
              <p className="mt-1 text-sm font-semibold text-secondary">{job.salary || t("jobCard.negotiable", { defaultValue: "Negotiable" })}</p>
              <p className="mt-1 text-sm text-slate-600">
                {job.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/jobs/${job._id}`}
                  className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  {t("common.view", { defaultValue: "View" })}
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(job._id)}
                  className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  {t("common.delete", { defaultValue: "Delete" })}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default MyPostingsPage;

