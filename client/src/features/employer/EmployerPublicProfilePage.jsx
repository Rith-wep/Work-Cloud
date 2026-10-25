import { BadgeCheck, Globe, PhoneCall, Send, Star, Users } from "lucide-react";
import { FaMapMarkerAlt } from "react-icons/fa/index.js";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import LazyAvatar from "../../shared/components/LazyAvatar.jsx";
import { ProfileSkeleton } from "../../shared/components/PageSkeleton.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function EmployerPublicProfilePage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const companyName = useMemo(() => profile?.companyName || "Company", [profile?.companyName]);
  const telegramUrl = useMemo(() => {
    const username = String(profile?.businessTelegramUsername || "").trim().replace(/^@/, "");
    return username ? `https://t.me/${username}` : "";
  }, [profile?.businessTelegramUsername]);
  const phoneUrl = useMemo(() => {
    const phone = String(profile?.businessPhoneNumber || "").trim();
    return phone ? `tel:${phone}` : "";
  }, [profile?.businessPhoneNumber]);
  const isKhmer = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .startsWith("km");

  useEffect(() => {
    const fetchPublicEmployer = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`${API_BASE_URL}/users/employer/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch employer profile");
        }

        setProfile(data.profile || null);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicEmployer();
  }, [id]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-slate-500">Company profile not found.</p>;
  }

  return (
    <section className="space-y-4">
      <Link to="/jobs" className="text-sm font-semibold text-indigo-600">
        {t("jobDetails.backToFeed", { defaultValue: "Back to feed" })}
      </Link>

      <article className="overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-sm backdrop-blur-md">
        {profile.companyCoverPicture ? (
          <img
            src={profile.companyCoverPicture}
            alt={`${companyName} cover`}
            className="h-28 w-full object-cover sm:h-36"
            loading="lazy"
          />
        ) : (
          <div className="h-28 bg-gradient-to-r from-indigo-600 to-blue-500 sm:h-36" />
        )}
        <div className="px-5 pb-5">
          <div className="-mt-12 flex flex-col items-start gap-3 sm:-mt-14">
            <LazyAvatar
              src={profile.companyLogo || ""}
              alt={companyName}
              name={companyName}
              className="h-20 w-20 rounded-2xl border-4 border-white shadow-md sm:h-24 sm:w-24"
              textClassName="text-xl"
            />
            <div className="min-w-0 w-full">
              <h1 className="inline-flex max-w-full items-center gap-2 text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900 sm:text-[34px]">
                <span className="truncate">{companyName}</span>
                <BadgeCheck size={19} className="shrink-0 text-blue-600" />
              </h1>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <p
                  className="break-words text-[14px] leading-7 text-slate-700"
                  style={
                    isKhmer
                      ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                      : undefined
                  }
                >
                  {profile.companyDescription || "No company description provided."}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {profile.companyWebsite ? (
              <a
                href={profile.companyWebsite}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Globe size={14} />
                <span>{profile.companyWebsite}</span>
              </a>
            ) : null}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div
                className="flex flex-wrap items-center gap-2 text-sm text-slate-700"
                style={
                  isKhmer
                    ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                    : undefined
                }
              >
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-indigo-700">
                  <Star size={14} />
                  <span>
                    {t("profile.averageRating", { defaultValue: "Average Rating" })}:{" "}
                    {Number(profile.averageRating || 0).toFixed(1)}
                  </span>
                </span>
                {String(profile.companySize || "").trim() ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-slate-700 shadow-sm">
                    <Users size={14} />
                    <span>{profile.companySize}</span>
                  </span>
                ) : null}
                {String(profile.companyAddress || "").trim() ? (
                  <div className="w-full rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
                    <div className="inline-flex items-center gap-1.5 text-indigo-600">
                      <FaMapMarkerAlt className="shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {t("profile.companyAddress", { defaultValue: "Location" })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line break-all text-sm leading-6 text-slate-700">
                      {String(profile.companyAddress || "")
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean)
                        .join("\n")}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {telegramUrl ? (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition duration-200 hover:bg-indigo-700"
                    style={
                      isKhmer
                        ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                        : undefined
                    }
                  >
                    <Send size={15} />
                    <span>{t("profile.chatOnTelegram", { defaultValue: "Chat on Telegram" })}</span>
                  </a>
                ) : null}
                {phoneUrl ? (
                  <a
                    href={phoneUrl}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition duration-200 hover:bg-slate-50"
                    style={
                      isKhmer
                        ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                        : undefined
                    }
                  >
                    <PhoneCall size={15} />
                    <span>{t("profile.callBusiness", { defaultValue: "Call Business" })}</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

export default EmployerPublicProfilePage;

