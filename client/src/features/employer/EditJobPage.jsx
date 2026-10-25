import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../shared/context/AuthContext.jsx";
import { FormSkeleton } from "../../shared/components/PageSkeleton.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const CATEGORY_OPTIONS = [
  "Delivery",
  "Cleaning",
  "Construction",
  "IT/Digital",
  "Teaching",
  "Event Staff",
];

function EditJobPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    salary: "",
    category: "Delivery",
    vacancies: 1,
    status: "open",
    address: "",
    lat: "",
    lng: "",
  });

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || t("jobDetails.failedFetch", { defaultValue: "Failed to fetch job" }));
        }

        const job = data.job;
        const ownerId = String(job?.companyId || job?.employerId?._id || job?.employerId || "");
        const currentEmployerId = String(user?.id || "");
        if (!ownerId || ownerId !== currentEmployerId) {
          throw new Error(t("auth.forbiddenOwnJob", { defaultValue: "Forbidden: you can only edit your own job" }));
        }

        setForm({
          title: job.title || "",
          description: job.description || "",
          salary: job.salary || "",
          category: job.category || "Delivery",
          vacancies: Number(job.vacancies ?? job.hiringLimit ?? 1),
          status: job.status === "closed" ? "closed" : "open",
          address: job.location?.address || "",
          lat: Number.isFinite(Number(job.location?.lat)) ? String(job.location.lat) : "",
          lng: Number.isFinite(Number(job.location?.lng)) ? String(job.location.lng) : "",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId && user?.id) {
      fetchJob();
    }
  }, [jobId, user?.id]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      setError("");

      const lat = Number(form.lat);
      const lng = Number(form.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(t("postJob.validCoordinatesRequired", { defaultValue: "Valid latitude and longitude are required" }));
      }

      const payload = {
        title: form.title,
        description: form.description,
        salary: form.salary,
        category: form.category,
        status: form.status,
        vacancies: Math.max(1, Number(form.vacancies) || 1),
        location: {
          address: form.address,
          lat,
          lng,
        },
      };

      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("editJob.failedUpdate", { defaultValue: "Failed to update job" }));
      }

      navigate("/workspace");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">{t("editJob.title", { defaultValue: "Edit Job" })}</h1>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {isLoading ? (
        <FormSkeleton fields={7} />
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <input
            value={form.title}
            onChange={(event) => handleChange("title", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            placeholder={t("postJob.jobTitle", { defaultValue: "Job title" })}
            required
          />
          <textarea
            value={form.description}
            onChange={(event) => handleChange("description", event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={t("postJob.jobDescription", { defaultValue: "Job description" })}
            rows={4}
            required
          />
          <input
            value={form.salary}
            onChange={(event) => handleChange("salary", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            placeholder={t("postJob.salary", { defaultValue: "Salary (e.g. $15/hour)" })}
            required
          />
          <select
            value={form.category}
            onChange={(event) => handleChange("category", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.vacancies}
              min={1}
              type="number"
              onChange={(event) => handleChange("vacancies", event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
              placeholder={t("editJob.vacancies", { defaultValue: "Number of Openings" })}
            />
            <select
              value={form.status}
              onChange={(event) => handleChange("status", event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="open">{t("editJob.open", { defaultValue: "Open" })}</option>
              <option value="closed">{t("editJob.closed", { defaultValue: "Closed" })}</option>
            </select>
          </div>
          <input
            value={form.address}
            onChange={(event) => handleChange("address", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            placeholder={t("postJob.searchSelectAddress", { defaultValue: "Search and select address" })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.lat}
              onChange={(event) => handleChange("lat", event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
              placeholder={t("postJob.latitude", { defaultValue: "Latitude" })}
              required
            />
            <input
              value={form.lng}
              onChange={(event) => handleChange("lng", event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
              placeholder={t("postJob.longitude", { defaultValue: "Longitude" })}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate("/workspace")}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSaving
                ? t("common.saving", { defaultValue: "Saving..." })
                : t("editJob.saveChanges", { defaultValue: "Save Changes" })}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default EditJobPage;

