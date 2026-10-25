import { useEffect, useState } from "react";
import {
  FaBolt,
  FaChartLine,
  FaCheckCircle,
  FaHome,
  FaLeaf,
  FaPaperPlane,
  FaRobot,
  FaTimes,
} from "react-icons/fa/index.js";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext.jsx";
import { toSkillKey } from "../utils/skills.js";

const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || "http://localhost:8000";
const AI_TERMS_KEY = "workcloud_ai_terms_accepted";

function AIChatPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAISending, setIsAISending] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    try {
      return window.localStorage.getItem(AI_TERMS_KEY) === "true";
    } catch {
      return false;
    }
  });
  const acceptTerms = () => {
    setHasAcceptedTerms(true);
    try {
      window.localStorage.setItem(AI_TERMS_KEY, "true");
    } catch {
      // no-op
    }
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__resetWorkcloudAiTerms = () => {
      try {
        window.localStorage.removeItem(AI_TERMS_KEY);
      } catch {
        // no-op
      }
    };
    return () => {
      delete window.__resetWorkcloudAiTerms;
    };
  }, []);
  const activeLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const normalizeTipText = (value) =>
    String(value || "")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .trim();
  const getTipLabel = (category) => {
    if (category === "__remote__") {
      return {
        icon: FaHome,
        label: normalizeTipText(t("ai.remoteTip", { defaultValue: "Remote" })),
      };
    }
    if (category === "__no_experience__") {
      return {
        icon: FaLeaf,
        label: normalizeTipText(t("ai.noExperienceTip", { defaultValue: "No Experience" })),
      };
    }
    if (category === "__junior__") {
      return {
        icon: FaBolt,
        label: normalizeTipText(t("ai.juniorTip", { defaultValue: "Junior" })),
      };
    }
    if (category === "__senior__") {
      return {
        icon: FaChartLine,
        label: normalizeTipText(t("ai.seniorTip", { defaultValue: "Senior" })),
      };
    }
    return {
      icon: null,
      label: t(`categories.${toSkillKey(category)}`, { defaultValue: category }),
    };
  };

  const sendAIPrompt = async (promptText) => {
    const nextPrompt = String(promptText || "").trim();
    if (!nextPrompt || isAISending) return;

    const userMessage = { id: `u-${Date.now()}`, role: "user", text: nextPrompt };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiPrompt("");
    setIsAISending(true);

    try {
      const response = await fetch(`${AI_API_BASE_URL}/api/ai/job-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: nextPrompt,
          language: activeLanguage,
          preferredCategory:
            user?.preferredCategory ||
            (Array.isArray(user?.preferredCategories) ? user.preferredCategories[0] : ""),
          preferredExperienceLevel: user?.preferredExperienceLevel || "",
          prefersRemote: Boolean(user?.prefersRemote),
          skills: Array.isArray(user?.skills) ? user.skills : [],
          isVerified: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "AI request failed");
      }

      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const primaryMessage =
        ((String(data?.type || "") === "out_of_scope" && data?.message
          ? t(String(data.message), {
              defaultValue:
                "I can only help with career questions. Try asking for jobs by category, location, or salary.",
            })
          : "") ||
          (data?.chat_key
            ? t(String(data.chat_key), {
                defaultValue:
                  "I can only help with career questions. Try asking for jobs by category, location, or salary.",
              })
            : "")) ||
        String(data?.chat_message || "").trim() ||
        (jobs.length > 0
          ? t("ai.resultsFound", {
              defaultValue: "I found {{count}} jobs based on your request.",
              count: jobs.length,
            })
          : t("ai.noResults", {
              defaultValue: "No matching jobs found. Try another location or category.",
            }));

      const nextMessages = [
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: primaryMessage,
          jobs,
          showTips:
            String(data?.type || "") === "out_of_scope" ||
            Boolean(data?.show_tips) ||
            jobs.length === 0,
          tipCategories: Array.isArray(data?.tips_categories)
            ? data.tips_categories
            : [
                "Delivery",
                "Cleaning",
                "IT/Digital",
                "__remote__",
                "__no_experience__",
                "__junior__",
                "__senior__",
              ],
        },
      ];

      const isOutOfScopeRecovery =
        String(data?.type || "") === "out_of_scope" ||
        String(data?.chat_key || "") === "ai.outOfScope";
      if (isOutOfScopeRecovery) {
        nextMessages.push({
          id: `b-paywall-${Date.now()}`,
          role: "bot",
          text: t("paywall.khPersonalMessage", {
            defaultValue: "Verify your account to see jobs that perfectly match your skills!",
          }),
          suggestVerify: false,
        });
      }
      const requestedNoExperience =
        Boolean(data?.filters?.noExperience) ||
        ["entry"].includes(String(data?.filters?.experienceLevel || "").toLowerCase()) ||
        String(data?.filters?.tier || "") === "no_experience";
      if (false && requestedNoExperience) {
        nextMessages.push({
          id: `b-entry-remote-nudge-${Date.now()}`,
          role: "bot",
          text:
            "ផ្ទៀងផ្ទាត់គណនីឥឡូវនេះ ដើម្បីឱ្យក្រុមហ៊ុនមើលឃើញពីសមត្ថភាពពិតរបស់អ្នក!",
          suggestVerify: false,
        });
      }

      setAiMessages((prev) => [...prev, ...nextMessages]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `b-err-${Date.now()}`,
          role: "bot",
          text:
            err.message ||
            t("ai.error", { defaultValue: "AI assistant is temporarily unavailable." }),
        },
      ]);
    } finally {
      setIsAISending(false);
    }
  };

  const handleAISearch = async (event) => {
    event.preventDefault();
    await sendAIPrompt(aiPrompt);
  };

  const handleTipClick = async (tip) => {
    const tipText = String(tip || "");
    if (tipText === "__remote__") {
      await sendAIPrompt(
        t("ai.tipRemotePrompt", { defaultValue: "Remote jobs" })
      );
      return;
    }
    if (tipText === "__no_experience__") {
      await sendAIPrompt(
        t("ai.tipNoExperiencePrompt", { defaultValue: "No experience jobs" })
      );
      return;
    }
    if (tipText === "__junior__") {
      await sendAIPrompt(
        t("ai.tipJuniorPrompt", { defaultValue: "Junior jobs" })
      );
      return;
    }
    if (tipText === "__senior__") {
      await sendAIPrompt(
        t("ai.tipSeniorPrompt", { defaultValue: "Senior jobs" })
      );
      return;
    }
    await sendAIPrompt(`${tipText} jobs`);
  };

  return (
    <section className="flex min-h-[calc(100vh-9.5rem)] flex-col space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 p-3 text-white shadow-[0_12px_28px_rgba(79,70,229,0.35)]">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/35 ${isAISending ? "animate-pulse" : ""}`}>
            <FaRobot className="text-white" size={14} />
          </span>
          <h1 className="text-base font-bold text-white">{t("ai.title", { defaultValue: "WorkCloud Bot" })}</h1>
        </div>
        <Link
          to="/jobs"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
          aria-label={t("common.close", { defaultValue: "Close" })}
          title={t("common.close", { defaultValue: "Close" })}
        >
          <FaTimes size={13} />
        </Link>
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_14px_38px_rgba(15,23,42,0.2)] backdrop-blur-md"
        style={{ backdropFilter: "blur(8px)" }}
      >
        {hasAcceptedTerms ? (
        <>
        <div
          className={`flex-1 space-y-2 overflow-y-auto p-3 ${
            activeLanguage === "km"
              ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif] leading-relaxed"
              : ""
          }`}
          style={activeLanguage === "km" ? { lineHeight: 1.6 } : undefined}
        >
          {aiMessages.length === 0 ? (
            <div
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm"
              style={{
                fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
                lineHeight: 1.6,
              }}
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                <FaRobot size={13} />
              </span>
              <p className="text-sm text-slate-700">
                {t("ai.welcome", {
                  defaultValue: "Ask me for jobs by category, location, or salary.",
                })}
              </p>
            </div>
          ) : null}

          {aiMessages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[90%] rounded-xl px-3 py-2 text-left text-sm leading-relaxed break-words whitespace-pre-wrap ${
                  message.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {message.text}
              </div>

              {Array.isArray(message.jobs) && message.jobs.length > 0 ? (
                <div className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
                  {message.jobs.map((job) => (
                    <Link
                      key={`ai-job-${job._id}`}
                      to={`/jobs/${job._id}`}
                      className="w-64 shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.companyProfile?.companyName || t("common.company", { defaultValue: "Company" })}
                      </p>
                      <p className="mt-1 text-xs font-bold text-indigo-600">{job.salary}</p>
                      <p className="mt-1 truncate text-xs font-medium text-slate-700">
                        {job.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : null}

              {message.showTips ? (
                <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-left">
                  <p className="text-xs font-semibold text-indigo-700">
                    {t("ai.tipsTitle", { defaultValue: "Quick tips to find jobs faster" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(message.tipCategories || [
                      "Delivery",
                      "Cleaning",
                      "IT/Digital",
                      "__remote__",
                      "__no_experience__",
                      "__junior__",
                      "__senior__",
                    ]).map((category) => {
                      const tip = getTipLabel(category);
                      const TipIcon = tip.icon;
                      return (
                        <button
                          type="button"
                          key={`tip-${message.id}-${category}`}
                          onClick={() => handleTipClick(category)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                          style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif", lineHeight: 1.6 }}
                        >
                          {TipIcon ? <TipIcon size={10} className="text-indigo-500" /> : null}
                          <span>{tip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {message.suggestVerify ? null : null}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAISearch}
          className="flex items-end gap-2 border-t border-slate-200 bg-white/90 p-3"
        >
          <input
            type="text"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder={t("ai.askPlaceholder", { defaultValue: "រកការងារ Remote ឬការងារមិនត្រូវការបទពិសោធន៍..." })}
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm leading-5 text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={isAISending}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-[0_8px_18px_rgba(79,70,229,0.3)] transition hover:brightness-110 disabled:opacity-60"
          >
            <FaPaperPlane size={14} />
          </button>
        </form>
        </>
        ) : null}

        {!hasAcceptedTerms ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/30 p-4">
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <h3 className="text-lg font-bold text-slate-900">
                {t("ai.title", { defaultValue: "WorkCloud Bot" })}
              </h3>
              <p className="mt-2 text-sm font-bold text-slate-700">
                {t("ai.welcome", {
                  defaultValue: "WorkCloud Bot focuses exclusively on finding jobs and career advice.",
                })}
              </p>
              <button
                type="button"
                onClick={acceptTerms}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#4F46E5] px-4 text-base font-semibold text-white shadow-md transition hover:brightness-110"
              >
                OK
              </button>
            </div>
          </div>
        ) : null}
      </div>

    </section>
  );
}

export default AIChatPage;

