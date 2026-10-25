import { CheckCircle2, Mail, Phone, Send, Shield, User, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import LazyAvatar from "../components/LazyAvatar.jsx";
import { ProfileSkeleton } from "../components/PageSkeleton.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getTrustMeta = (score) => {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));
  if (normalized >= 80) return { level: "Gold", color: "#10b981", progress: normalized };
  if (normalized >= 40) return { level: "Silver", color: "#2563eb", progress: normalized };
  return { level: "Bronze", color: "#4f46e5", progress: normalized };
};

function CandidatePublicProfilePage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const trustScore = Number(profile?.trustScore || 0);
  const trustMeta = useMemo(() => getTrustMeta(trustScore), [trustScore]);
  const circumference = 2 * Math.PI * 44;
  const strokeOffset = circumference * (1 - trustMeta.progress / 100);

  useEffect(() => {
    const fetchCandidateProfile = async () => {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/users/candidate/${id}/public`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch candidate profile");
        }

        setProfile(data.profile || null);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandidateProfile();
  }, [id, token]);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-slate-500">Candidate profile not found.</p>;
  }

  return (
    <section className="space-y-4">
      <Link to="/workspace" className="text-sm font-semibold text-indigo-600">
        {t("workspace.backToWorkspace", { defaultValue: "Back to workspace" })}
      </Link>

      <article className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-start gap-4">
          <LazyAvatar
            src={profile.profilePicture || ""}
            alt={profile.name || "Candidate"}
            name={profile.name || "C"}
            className="h-16 w-16"
            textClassName="text-xl"
          />
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">{profile.name || "Candidate"}</h1>
            <p className="inline-flex items-center gap-2 text-sm text-slate-600">
              <Mail size={14} />
              <span>{profile.email || "-"}</span>
            </p>
            {Array.isArray(profile.verifiedBadges) && profile.verifiedBadges.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={13} />
                <span>Verified</span>
              </span>
            ) : null}
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f0" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={trustMeta.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-900">{trustScore}</span>
              <span className="text-[11px] font-semibold text-slate-500">
                {t(`profile.levels.${String(trustMeta.level).toLowerCase()}`, {
                  defaultValue: trustMeta.level,
                })}
              </span>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            <p className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600">
              <Shield size={14} />
              <span>Trust Score</span>
            </p>
            <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              <Users size={14} />
              <span>Verified Applications: {Number(profile.verifiedApplicationsCount || 0)}</span>
            </p>
            <p className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 size={14} />
              <span>Success Rate: {Number(profile.stats?.successRate || 0)}%</span>
            </p>
            <p className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              <User size={14} />
              <span>Avg Rating: {Number(profile.stats?.averageRating || 0).toFixed(1)}</span>
            </p>
          </div>
        </div>
      </article>

      <article className="space-y-4 rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Users size={14} />
            <span>{t("profile.bioStrengths", { defaultValue: "Bio (Personal Strengths)" })}</span>
          </p>
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
            {profile.bio || "No bio provided."}
          </p>
        </div>

        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Phone size={14} />
            <span>Contact</span>
          </p>
          {profile.canViewSensitiveContact ? (
            <div className="space-y-2">
              <p className="inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                <Phone size={14} className="text-slate-400" />
                <span>{profile.contact?.phoneNumber || "-"}</span>
              </p>
              <p className="inline-flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                <Send size={14} className="text-slate-400" />
                <span>{profile.contact?.telegramUsername ? `@${profile.contact.telegramUsername}` : "-"}</span>
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Contact details are visible only when there is an active contracted application.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}

export default CandidatePublicProfilePage;
