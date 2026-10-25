import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../shared/context/AuthContext.jsx";
import ProfilePage from "../profile/ProfilePage.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function CompanyProfile() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [stats, setStats] = useState({ viewsCount: 0, applicantsCount: 0, jobsCount: 0 });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/stats/employer`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch company stats");
        }
        setStats({
          viewsCount: Number(data?.stats?.viewsCount || 0),
          applicantsCount: Number(data?.stats?.applicantsCount || 0),
          jobsCount: Number(data?.stats?.totalJobs || data?.stats?.jobsCount || 0),
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          {t("workspace.activeJobStats", { defaultValue: "Active Job Stats" })}
        </h2>
        {error ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
        ) : null}
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">
            {t("common.loading", { defaultValue: "Loading..." })}
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">
              {t("workspace.numberOfViews", { defaultValue: "Number of views" })}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">{isLoading ? "..." : stats.viewsCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">
              {t("workspace.numberOfApplicants", { defaultValue: "Number of applicants" })}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">{isLoading ? "..." : stats.applicantsCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">
              {t("workspace.totalJobs", { defaultValue: "Total jobs" })}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">{isLoading ? "..." : stats.jobsCount}</p>
          </div>
        </div>
      </article>

      <ProfilePage />
    </section>
  );
}

export default CompanyProfile;


