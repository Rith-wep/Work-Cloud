import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  FaBriefcase,
  FaChevronLeft,
  FaDollarSign,
  FaHome,
  FaMapMarkerAlt,
} from "react-icons/fa/index.js";

import { useAuth } from "../../shared/context/AuthContext.jsx";
import { DetailSkeleton } from "../../shared/components/PageSkeleton.jsx";
import { getTopSkills, toSkillKey } from "../../shared/utils/skills.js";
import { toastPromise } from "../../shared/utils/toast.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function JobDetailsPage() {
  const { t, i18n } = useTranslation();
  const { jobId } = useParams();
  const { token, user } = useAuth();
  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const isCandidate = user?.role === "candidate";
  const activeLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const isKhmer = activeLanguage === "km";
  const employerProfileId =
    job?.companyId ||
    job?.employerId?._id ||
    job?.employerId?.id ||
    null;
  const mapPreviewUrl = (() => {
    const lat = Number(job?.location?.lat);
    const lng = Number(job?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !MAPS_KEY) {
      return "";
    }
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=1000x420&markers=color:0x4F46E5|${lat},${lng}&style=feature:all|element:labels|visibility:off&key=${MAPS_KEY}`;
  })();

  const requiredSkillPool = Array.isArray(job?.requiredSkills)
    ? job.requiredSkills
    : Array.isArray(job?.requirements)
      ? job.requirements
      : [];
  const topSkills = getTopSkills(requiredSkillPool, 6);
  const mapDeepLink = (() => {
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
  })();
  const isRemoteJob =
    (typeof job?.isRemote === "boolean" && job.isRemote) ||
    (typeof job?.is_remote === "boolean" && job.is_remote) ||
    (typeof job?.remote === "boolean" && job.remote) ||
    String(job?.tier_level || "").toLowerCase() === "remote" ||
    String(job?.workMode || "").toLowerCase() === "remote";

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch job");
        }

        setJob(data.job);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>;
  }

  if (!job) {
    return <p className="text-sm text-slate-500">{t("jobDetails.notFound")}</p>;
  }

  const vacancies = Math.max(1, Number(job.vacancies ?? job.hiringLimit) || 1);
  const hiredCount = Math.max(0, Number(job.hiredCount || 0));
  const remainingSpots = Math.max(0, vacancies - hiredCount);
  const isJobOpen = String(job.status || "open").toLowerCase() === "open";
  const canApplyToJob = isJobOpen && remainingSpots > 0;

  const handleApply = async () => {
    try {
      const applyPromise = (async () => {
        const response = await fetch(`${API_BASE_URL}/applications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ jobId }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || t("jobDetails.failedApply"));
        }

        return data;
      })();

      await toastPromise(applyPromise, {
        loading: "Sending application...",
        success: "Application submitted successfully",
        error: (err) => err?.message || "Application failed",
      });
    } catch {
      // toast handles feedback
    }
  };

  return (
    <section
      className={`space-y-5 pb-24 sm:pb-6 ${isKhmer ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]" : "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"}`}
      style={{ lineHeight: 1.6 }}
    >
      <Link
        to="/jobs"
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
      >
        <FaChevronLeft size={12} />
        {t("jobDetails.backToFeed", { defaultValue: "Back to Feed" })}
      </Link>

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <h1 className="text-2xl font-bold leading-snug text-slate-900">{job.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700">
            <FaDollarSign size={13} className="text-purple-500" />
            <span>{job.salary || t("jobCard.negotiable")}</span>
          </p>
          {job?.category ? (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700">
              <FaBriefcase size={12} className="text-indigo-600" />
              <span>{t(`categories.${toSkillKey(job.category)}`, { defaultValue: job.category })}</span>
            </p>
          ) : null}
          {isRemoteJob ? (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-indigo-600 bg-[#4F46E5] px-3 py-1 text-sm font-bold text-white">
              <FaHome size={12} className="text-white" />
              <span>{t("jobCard.remote", { defaultValue: "Remote" })}</span>
            </p>
          ) : null}
        </div>
        <p className="mt-4 inline-flex min-w-0 items-center gap-1.5 text-base text-slate-600">
          <FaMapMarkerAlt size={13} className="shrink-0 text-slate-500" />
          <span className="truncate">
            {job.location?.address || t("jobCard.locationTbd")}
          </span>
        </p>
        <p className="mt-3 inline-flex w-fit items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          {hiredCount} of {vacancies} positions filled. {remainingSpots} remaining.
        </p>
        <p className="mt-6 break-words text-base leading-relaxed text-slate-700">{job.description}</p>
        {requiredSkillPool.length ? (
          <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t("jobCard.requiredSkills", { defaultValue: "Requirements" })}
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-base text-slate-700 marker:text-slate-600">
              {requiredSkillPool.map((skill) => (
                <li key={`req-${skill}`} className="break-words py-1 text-[17px] leading-relaxed text-slate-700">
                  {t(`skills.${toSkillKey(skill)}`, { defaultValue: skill })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {isCandidate ? (
          <div className="mt-8">
            {canApplyToJob ? (
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#4F46E5] px-6 text-base font-semibold text-white shadow-md transition hover:brightness-110"
              >
                {t("jobDetails.apply")}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-300 px-6 text-base font-semibold text-slate-700"
              >
                Position Filled
              </button>
            )}
          </div>
        ) : null}
      </article>

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("map.mapView", { defaultValue: "Map" })}
          </h2>
        </div>
        {mapPreviewUrl ? (
          <img
            src={mapPreviewUrl}
            alt={job.location?.address || "Map location"}
            loading="lazy"
            decoding="async"
            className="h-64 w-full object-cover sm:h-72"
          />
        ) : (
          <div className="flex h-64 items-center justify-center bg-slate-50 px-4 text-sm text-slate-500 sm:h-72">
            {t("jobCard.mapPreviewUnavailable", { defaultValue: "Map preview unavailable" })}
          </div>
        )}
        {mapDeepLink ? (
          <div className="px-5 py-4">
            <a
              href={mapDeepLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-xl bg-[#4F46E5] px-5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {t("jobDetails.openInMaps", { defaultValue: "Open in Google Maps" })}
            </a>
          </div>
        ) : null}
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h2 className="ml-1 text-base font-bold leading-none text-slate-800">
          {t("jobDetails.company", { defaultValue: "Company" })}
        </h2>
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start gap-4">
          {job.companyProfile?.companyLogo || job.employerId?.companyLogo ? (
            <img
              src={job.companyProfile?.companyLogo || job.employerId?.companyLogo}
              alt={job.companyProfile?.companyName || job.employerId?.companyName || "Company"}
              loading="lazy"
              decoding="async"
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-primary ring-2 ring-white shadow-sm">
              {(job.companyProfile?.companyName || job.employerId?.companyName || "CO")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-words text-xl font-bold leading-tight text-slate-900">
              {job.companyProfile?.companyName ||
                job.employerId?.companyName ||
                job.employerId?.name ||
                "Company"}
            </p>
            {job.companyProfile?.companyWebsite || job.employerId?.companyWebsite ? (
              <a
                href={job.companyProfile?.companyWebsite || job.employerId?.companyWebsite}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                {job.companyProfile?.companyWebsite || job.employerId?.companyWebsite}
              </a>
            ) : null}
            {job.companyProfile?.businessRegistration || job.employerId?.businessRegistration ? (
              <p className="inline-flex w-fit items-center rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                Registration:{" "}
                {job.companyProfile?.businessRegistration || job.employerId?.businessRegistration}
              </p>
            ) : null}
            {job.companyProfile?.companySize || job.employerId?.companySize ? (
              <p className="inline-flex w-fit items-center rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                Team size: {job.companyProfile?.companySize || job.employerId?.companySize}
              </p>
            ) : null}
            <p className="break-words text-sm leading-relaxed text-slate-600">
              {job.companyProfile?.companyDescription ||
                job.employerId?.companyDescription ||
                "No company description provided."}
            </p>
            {employerProfileId ? (
              <Link
                to={`/employers/${employerProfileId}`}
                className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 sm:w-auto"
              >
                {t("profile.viewCompanyProfile", { defaultValue: "View Company Profile" })}
              </Link>
            ) : null}
          </div>
          </div>
        </div>
      </article>
    </section>
  );
}

export default JobDetailsPage;

