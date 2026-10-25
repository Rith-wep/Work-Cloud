import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBolt,
  FaBroom,
  FaChartLine,
  FaCheckCircle,
  FaCode,
  FaHome,
  FaExpandArrowsAlt,
  FaHardHat,
  FaInbox,
  FaPaperPlane,
  FaLeaf,
  FaRobot,
  FaSearch,
  FaChevronDown,
  FaTimes,
  FaTruck,
  FaUserGraduate,
  FaUsers,
} from "react-icons/fa/index.js";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import JobCard from "../../shared/components/JobCard.jsx";
import SkeletonCard from "../../shared/components/SkeletonCard.jsx";
import { useAuth } from "../../shared/context/AuthContext.jsx";
import { calculateMatchScore, toSkillKey } from "../../shared/utils/skills.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || "http://localhost:8000";
const PAGE_SIZE = 4;
const AI_TERMS_KEY = "workcloud_ai_terms_accepted";

const CATEGORIES = [
  { key: "All", icon: FaBolt },
  { key: "AllJobs", icon: FaInbox },
  { key: "Match", icon: FaCheckCircle },
  { key: "Delivery", icon: FaTruck },
  { key: "Cleaning", icon: FaBroom },
  { key: "Construction", icon: FaHardHat },
  { key: "IT/Digital", icon: FaCode },
  { key: "Teaching", icon: FaUserGraduate },
  { key: "Event Staff", icon: FaUsers },
];

const CATEGORY_ICON_BY_KEY = {
  all: FaBolt,
  alljobs: FaInbox,
  match: FaCheckCircle,
  delivery: FaTruck,
  cleaning: FaBroom,
  construction: FaHardHat,
  it_digital: FaCode,
  teaching: FaUserGraduate,
  event_staff: FaUsers,
};

function HomePage() {
  const { t, i18n } = useTranslation();
  const { user, token } = useAuth();
  const isEmployer = user?.role === "employer";
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [jobModeFilter, setJobModeFilter] = useState("all");
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
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
  const sentinelRef = useRef(null);
  const aiTextareaRef = useRef(null);
  const modeMenuRef = useRef(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const activeLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const preferredCategoryKeys = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(Array.isArray(user?.preferredCategories) ? user.preferredCategories : []),
            user?.preferredCategory,
          ]
            .map((entry) => toSkillKey(String(entry || "").trim()))
            .filter(Boolean)
        )
      ),
    [user?.preferredCategories, user?.preferredCategory]
  );
  const categoryOptions = useMemo(() => {
    const baseKeys = new Set(CATEGORIES.map((entry) => toSkillKey(entry.key)));
    const dynamicEntries = (Array.isArray(catalogCategories) ? catalogCategories : [])
      .filter((entry) => !baseKeys.has(toSkillKey(entry.key || entry.label || "")))
      .map((entry) => ({
        key: entry.label || entry.key,
        icon: CATEGORY_ICON_BY_KEY[toSkillKey(entry.key || entry.label || "")] || FaBolt,
      }));
    return [...CATEGORIES, ...dynamicEntries];
  }, [catalogCategories]);
  const matchUserProfile = useMemo(
    () => ({
      selectedCategories: Array.isArray(user?.preferredCategories) && user.preferredCategories.length
        ? user.preferredCategories
        : user?.preferredCategory
          ? [user.preferredCategory]
          : [],
      selectedSkills: Array.isArray(user?.skills) ? user.skills : [],
    }),
    [user?.preferredCategories, user?.preferredCategory, user?.skills]
  );
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

  useEffect(() => {
    if (!token) {
      setCatalogCategories([]);
      return;
    }
    const fetchCatalog = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load categories");
        }
        setCatalogCategories(Array.isArray(data.categories) ? data.categories : []);
      } catch {
        setCatalogCategories([]);
      }
    };
    fetchCatalog();
  }, [token]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoading(true);
        setError("");

        const query =
          !isEmployer &&
          activeCategory !== "All" &&
          activeCategory !== "AllJobs" &&
          activeCategory !== "Match"
            ? `?category=${encodeURIComponent(activeCategory)}`
            : "";
        const endpoint = isEmployer ? `${API_BASE_URL}/jobs/my` : `${API_BASE_URL}/jobs${query}`;
        const response = await fetch(
          endpoint,
          isEmployer
            ? {
                headers: { Authorization: `Bearer ${token}` },
              }
            : token
              ? {
                  headers: { Authorization: `Bearer ${token}` },
                }
              : undefined
        );
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
  }, [activeCategory, isEmployer, token]);

  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      const query = search.toLowerCase();
      const titleMatch = job.title?.toLowerCase().includes(query);
      const locationMatch = job.location?.address?.toLowerCase().includes(query);
      const searchMatch = !search || titleMatch || locationMatch;

      const isRemoteJob =
        (typeof job?.isRemote === "boolean" && job.isRemote) ||
        (typeof job?.is_remote === "boolean" && job.is_remote) ||
        (typeof job?.remote === "boolean" && job.remote) ||
        String(job?.tier_level || "").toLowerCase() === "remote" ||
        String(job?.workMode || "").toLowerCase() === "remote";
      const minExpRaw = Number(job?.minExperience ?? job?.min_experience);
      const hasMinExp = Number.isFinite(minExpRaw);
      const expLevelRaw = String(job?.experienceLevel || "").toLowerCase();
      const tierLevelRaw = String(job?.tier_level || "").toLowerCase();
      const isNoExperienceJob =
        (hasMinExp && minExpRaw <= 0) ||
        tierLevelRaw === "no_experience" ||
        expLevelRaw === "entry" ||
        expLevelRaw.includes("intern") ||
        expLevelRaw.includes("fresher");
      const modeMatch =
        jobModeFilter === "all" ||
        (jobModeFilter === "remote" && isRemoteJob) ||
        (jobModeFilter === "noexp" && isNoExperienceJob) ||
        (jobModeFilter === "junior" &&
          !isRemoteJob &&
          !isNoExperienceJob &&
          (tierLevelRaw === "junior" || expLevelRaw === "junior" || (hasMinExp && minExpRaw > 0 && minExpRaw <= 2))) ||
        (jobModeFilter === "senior" &&
          !isRemoteJob &&
          (tierLevelRaw === "senior" || expLevelRaw === "senior" || (hasMinExp && minExpRaw > 2)));

      let skillMatch = true;
      if (!isEmployer && activeCategory === "Match") {
        skillMatch =
          preferredCategoryKeys.length > 0 &&
          preferredCategoryKeys.includes(toSkillKey(String(job?.category || "")));
      }

      let selectedCategoryMatch = true;
      if (
        !isEmployer &&
        activeCategory !== "All" &&
        activeCategory !== "AllJobs" &&
        activeCategory !== "Match"
      ) {
        selectedCategoryMatch =
          toSkillKey(String(job?.category || "")) === toSkillKey(String(activeCategory || ""));
      }

      let preferredCategoryMatch = true;
      if (!isEmployer && activeCategory === "All" && preferredCategoryKeys.length > 0) {
        preferredCategoryMatch = preferredCategoryKeys.includes(
          toSkillKey(String(job?.category || ""))
        );
      }

      return (
        searchMatch &&
        modeMatch &&
        skillMatch &&
        selectedCategoryMatch &&
        preferredCategoryMatch
      );
    });
    if (isEmployer) {
      return filtered;
    }
    return filtered
      .slice()
      .sort((a, b) => calculateMatchScore(matchUserProfile, b) - calculateMatchScore(matchUserProfile, a));
  }, [activeCategory, isEmployer, jobModeFilter, jobs, matchUserProfile, preferredCategoryKeys, search]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, jobModeFilter, activeCategory]);

  useEffect(() => {
    if (!sentinelRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredJobs.length));
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filteredJobs.length]);

  useEffect(() => {
    if (!isModeMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setIsModeMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isModeMenuOpen]);

  const visibleJobs = filteredJobs.slice(0, visibleCount);
  const modeOptions = [
    {
      value: "all",
      label: t("dashboard.filterAllJobs", { defaultValue: "All Jobs" }),
      icon: FaInbox,
    },
    {
      value: "remote",
      label: t("dashboard.filterRemote", { defaultValue: "Remote" }),
      icon: FaHome,
    },
    {
      value: "noexp",
      label: t("dashboard.filterNoExperience", { defaultValue: "No Experience" }),
      icon: FaUserGraduate,
    },
    {
      value: "junior",
      label: t("dashboard.filterJunior", { defaultValue: "Junior" }),
      icon: FaBolt,
    },
    {
      value: "senior",
      label: t("dashboard.filterSenior", { defaultValue: "Senior" }),
      icon: FaChartLine,
    },
  ];
  const activeModeOption = modeOptions.find((option) => option.value === jobModeFilter) || modeOptions[0];
  const ActiveModeIcon = activeModeOption.icon;

  const handleAISearch = async (event) => {
    event.preventDefault();
    const nextPrompt = String(aiPrompt || "").trim();
    if (!nextPrompt || isAISending) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: nextPrompt,
    };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiPrompt("");
    if (aiTextareaRef.current) {
      aiTextareaRef.current.style.height = "40px";
    }
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
          skills: Array.isArray(user?.skills) ? user.skills : [],
          isVerified: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "AI request failed");
      }

      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const botMessages = [];

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

      botMessages.push({
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
      });

      const isOutOfScopeRecovery =
        String(data?.type || "") === "out_of_scope" ||
        String(data?.chat_key || "") === "ai.outOfScope";
      if (isOutOfScopeRecovery) {
        botMessages.push({
          id: `b-paywall-${Date.now()}`,
          role: "bot",
          text: t("paywall.khPersonalMessage", {
            defaultValue:
              "Verify your account to see jobs that perfectly match your skills!",
          }),
          suggestVerify: false,
        });
      }
      const requestedNoExperience =
        Boolean(data?.filters?.noExperience) ||
        ["entry"].includes(String(data?.filters?.experienceLevel || "").toLowerCase()) ||
        String(data?.filters?.tier || "") === "no_experience";
      if (false && requestedNoExperience) {
        botMessages.push({
          id: `b-noexp-nudge-${Date.now()}`,
          role: "bot",
          text: "ផ្ទៀងផ្ទាត់គណនីឥឡូវនេះ ដើម្បីឱ្យក្រុមហ៊ុនមើលឃើញពីសមត្ថភាពពិតរបស់អ្នក!",
          suggestVerify: false,
        });
      }

      setAiMessages((prev) => [...prev, ...botMessages]);
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `b-err-${Date.now()}`,
          role: "bot",
          text: err.message || t("ai.error", { defaultValue: "AI assistant is temporarily unavailable." }),
        },
      ]);
    } finally {
      setIsAISending(false);
    }
  };

  const handleAiPromptChange = (event) => {
    const nextValue = event.target.value;
    setAiPrompt(nextValue);

    const element = aiTextareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    const computed = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const maxHeight = lineHeight * 4;
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  };

  const handleAiPromptKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleTipCategoryClick = (categoryKey) => {
    if (categoryKey === "__remote__") {
      setJobModeFilter("remote");
      setIsAIChatOpen(false);
      return;
    }
    if (categoryKey === "__no_experience__") {
      setJobModeFilter("noexp");
      setIsAIChatOpen(false);
      return;
    }
    if (categoryKey === "__junior__") {
      setJobModeFilter("junior");
      setIsAIChatOpen(false);
      return;
    }
    if (categoryKey === "__senior__") {
      setJobModeFilter("senior");
      setIsAIChatOpen(false);
      return;
    }
    setActiveCategory(categoryKey);
    setIsAIChatOpen(false);
  };
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

  return (
    <section
      className={`space-y-3 ${activeLanguage === "km" ? "wc-feed-text" : ""}`}
    >
      <header className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
        <h2 className="text-base font-bold text-slate-900 transition-all duration-300">
          {t("dashboard.discoverOpportunities", { defaultValue: "Discover Opportunities" })}
        </h2>

        <div className="relative rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
          <FaSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder={t("dashboard.searchPlaceholder", { defaultValue: "Search jobs or locations" })}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-full border border-slate-100 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-200 focus:bg-white"
          />
        </div>

        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryOptions.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => {
                  setActiveCategory(category.key);
                }}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-sm transition-all duration-300 ${
                  isActive
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-indigo-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
                <span>
                  {category.key === "All"
                    ? t("dashboard.forYou", { defaultValue: "For You" })
                    : category.key === "AllJobs"
                      ? t("dashboard.allJobs", { defaultValue: "All Jobs" })
                    : category.key === "Match"
                      ? t("dashboard.match", { defaultValue: "Match" })
                      : t(`categories.${toSkillKey(category.key)}`, {
                          defaultValue: category.key,
                        })}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative" ref={modeMenuRef}>
          <button
            type="button"
            onClick={() => setIsModeMenuOpen((prev) => !prev)}
            className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition hover:border-indigo-200"
            aria-haspopup="listbox"
            aria-expanded={isModeMenuOpen}
          >
            <span className="inline-flex items-center gap-2">
              <ActiveModeIcon size={13} className="text-slate-500" />
              <span className="font-semibold">{activeModeOption.label}</span>
            </span>
            <FaChevronDown
              size={12}
              className={`text-slate-500 transition-transform ${isModeMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isModeMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.16)]">
              <ul className="py-1" role="listbox" aria-label={t("dashboard.allJobs", { defaultValue: "All Jobs" })}>
                {modeOptions.map((option) => {
                  const OptionIcon = option.icon;
                  const isActive = option.value === jobModeFilter;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        onClick={() => {
                          setJobModeFilter(option.value);
                          setIsModeMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-indigo-600/10 font-semibold text-indigo-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <OptionIcon size={13} className={isActive ? "text-indigo-600" : "text-slate-500"} />
                        <span>{option.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </header>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <motion.div key={index} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}>
              <SkeletonCard />
            </motion.div>
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      ) : null}

      {!isLoading && !error && visibleJobs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-slate-600">
          <FaInbox size={24} className="mx-auto text-slate-400" />
          <p className="mt-2 text-sm font-semibold">
            {activeCategory === "All" || activeCategory === "AllJobs"
              ? t("dashboard.noJobs", { defaultValue: "No jobs found." })
              : t("dashboard.noJobsInCategory", {
                  defaultValue: `No jobs found in this category (${activeCategory}).`,
                  category: activeCategory,
                })}
          </p>
        </div>
      ) : null}

      {!isLoading && !error && visibleJobs.length > 0 ? (
        <div className="space-y-3">
          {visibleJobs.map((job, index) => (
            <JobCard
              key={job._id}
              job={job}
              index={index}
            />
          ))}
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-8" />

      {!isEmployer ? (
        <div className="fixed bottom-20 right-4 z-[75] sm:bottom-6">
          {isAIChatOpen ? (
            <div
              className={`relative flex w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_14px_38px_rgba(15,23,42,0.2)] backdrop-blur-md ${
                hasAcceptedTerms ? "" : "min-h-[360px]"
              }`}
              style={{ backdropFilter: "blur(8px)" }}
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-500 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 ${
                      isAISending ? "animate-pulse" : ""
                    }`}
                  >
                    <FaRobot size={14} />
                  </span>
                  <p className="text-sm font-semibold">
                    {t("ai.title", { defaultValue: "WorkCloud Bot" })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to="/ai-chat"
                    className="rounded-md p-1 hover:bg-white/15"
                    aria-label={t("ai.openFullPage", { defaultValue: "Open full page chat" })}
                    title={t("ai.openFullPage", { defaultValue: "Open full page chat" })}
                  >
                    <FaExpandArrowsAlt size={12} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsAIChatOpen(false)}
                    className="rounded-md p-1 hover:bg-white/15"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>

              {hasAcceptedTerms ? (
              <>
              <div
                className={`max-h-[52vh] space-y-2 overflow-y-auto p-3 ${
                  activeLanguage === "km" ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif] leading-relaxed" : ""
                }`}
                style={activeLanguage === "km" ? { lineHeight: 1.6 } : undefined}
              >
                {aiMessages.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {t("ai.welcome", {
                      defaultValue: "Ask me for jobs by category, location, or salary.",
                    })}
                  </p>
                ) : null}

                {aiMessages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                    <div
                      className={`inline-block max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                        message.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      } ${activeLanguage === "km" ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif] leading-relaxed" : ""}`}
                    >
                      {message.text}
                    </div>

                    {Array.isArray(message.jobs) && message.jobs.length > 0 ? (
                      <div className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
                        {message.jobs.map((job) => (
                          <Link
                            key={`ai-job-${job._id}`}
                            to={`/jobs/${job._id}`}
                            className="w-56 shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm"
                          >
                            <p className="truncate text-sm font-semibold text-slate-900">{job.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{job.companyProfile?.companyName || t("common.company", { defaultValue: "Company" })}</p>
                            <p className="mt-1 text-xs font-bold text-indigo-600">{job.salary}</p>
                            <p className="mt-1 truncate text-xs font-medium text-slate-700">{job.location?.address || t("jobCard.locationTbd", { defaultValue: "Location TBD" })}</p>
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
                                key={`tip-${message.id}-${category}`}
                                type="button"
                                onClick={() => handleTipCategoryClick(category)}
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

              <form onSubmit={handleAISearch} className="flex items-center gap-2 border-t border-slate-200 p-3">
                <textarea
                  ref={aiTextareaRef}
                  value={aiPrompt}
                  onChange={handleAiPromptChange}
                  onKeyDown={handleAiPromptKeyDown}
                  rows={1}
                  placeholder={t("ai.askPlaceholder", { defaultValue: "រកការងារ Remote ឬការងារមិនត្រូវការបទពិសោធន៍..." })}
                  className="max-h-24 min-h-10 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={isAISending}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-3 text-white disabled:opacity-60"
                >
                  <FaPaperPlane size={14} />
                </button>
              </form>
              </>
              ) : null}

              {!hasAcceptedTerms ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/30 p-4">
                  <div
                    className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xl"
                    style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                  >
                    <h3 className="text-base font-bold text-slate-900">
                      {t("ai.title", { defaultValue: "WorkCloud Bot" })}
                    </h3>
                    <p className="mt-2 break-words text-sm font-bold text-slate-700">
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
          ) : (
            <button
              type="button"
              onClick={() => setIsAIChatOpen(true)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-[0_10px_25px_rgba(79,70,229,0.45)]"
              aria-label={t("ai.open", { defaultValue: "Open WorkCloud Bot" })}
            >
              <FaRobot size={20} />
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default HomePage;






