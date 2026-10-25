import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import JobCard from "../../shared/components/JobCard.jsx";
import { useAuth } from "../../shared/context/AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function JobFeedPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/jobs`, token
          ? {
              headers: { Authorization: `Bearer ${token}` },
            }
          : undefined);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch jobs");
        }

        setJobs(data.jobs || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [token]);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-primary">{t("dashboard.title", { defaultValue: "Daily Opportunity Feed" })}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("dashboard.subtitle", { defaultValue: "Fresh local jobs, newest first." })}</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {!isLoading && !error ? (
        <div className="space-y-3 overflow-y-auto pb-2">
          {jobs.length ? (
            jobs.map((job, index) => <JobCard key={job._id} job={job} index={index} />)
          ) : (
            <p className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
              {t("dashboard.noJobs", { defaultValue: "No jobs found." })}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default JobFeedPage;

