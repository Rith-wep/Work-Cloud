import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
  CheckCircle,
  Code2,
  Download,
  MapPin,
  Pencil,
  Phone,
  Save,
  Send,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { FaFileAlt, FaGraduationCap, FaMapMarkerAlt, FaPhoneAlt, FaTelegramPlane } from "react-icons/fa/index.js";
import { FiLogOut } from "react-icons/fi/index.js";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";

import LazyAvatar from "../components/LazyAvatar.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { SKILL_SUGGESTIONS_BY_CATEGORY, toSkillKey } from "../utils/skills.js";
import { toastError, toastSuccess } from "../utils/toast.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || "http://localhost:8000";
const BRAND_INDIGO = "#4F46E5";
const CV_WARNING_TEXT = "សូមបំពេញព័ត៌មាននេះដើម្បីឱ្យ CV មានភាពទាក់ទាញ";
const AI_SLOW_MESSAGE_KM = "AI កំពុងរៀបចំអត្ថបទដ៏ល្អបំផុតសម្រាប់អ្នក...";
const KHMER_FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/kantumruypro/KantumruyPro-Regular.ttf";
const ENGLISH_FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter-Regular.ttf";
const SKILL_LABEL_OVERRIDES = {
  motorbike_riding: "Motorbike Operation",
  customer_service: "Customer Service",
  food_delivery: "Food Delivery",
  problem_solving: "Problem Solving",
  team_work: "Team Collaboration",
};
const SOFT_SKILL_KEYS = new Set([
  "communication",
  "customer_service",
  "team_work",
  "teamwork",
  "team_collaboration",
  "leadership",
  "problem_solving",
  "adaptability",
  "time_management",
  "critical_thinking",
  "collaboration",
  "negotiation",
  "creativity",
  "conflict_resolution",
  "work_ethic",
]);
let kantumruyFontPromise = null;
let englishFontPromise = null;

const toBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
};

const ensurePdfFont = async (doc, config) => {
  const { fontName, fileName, fontUrl, cacheRef } = config;
  if (!cacheRef.current) {
    cacheRef.current = fetch(fontUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Font download failed");
        }
        return response.arrayBuffer();
      })
      .then((buffer) => toBase64(buffer))
      .catch(() => null);
  }

  const fontBase64 = await cacheRef.current;
  if (!fontBase64) {
    return false;
  }

  if (!doc.getFontList()?.[fontName]) {
    doc.addFileToVFS(fileName, fontBase64);
    doc.addFont(fileName, fontName, "normal");
  }
  return true;
};

const ensureKantumruyProFont = async (doc) => {
  const cacheRef = {
    get current() {
      return kantumruyFontPromise;
    },
    set current(value) {
      kantumruyFontPromise = value;
    },
  };
  return ensurePdfFont(doc, {
    fontName: "KantumruyPro",
    fileName: "KantumruyPro-Regular.ttf",
    fontUrl: KHMER_FONT_URL,
    cacheRef,
  });
};

const ensureEnglishPdfFont = async (doc) => {
  const cacheRef = {
    get current() {
      return englishFontPromise;
    },
    set current(value) {
      englishFontPromise = value;
    },
  };
  return ensurePdfFont(doc, {
    fontName: "Inter",
    fileName: "Inter-Regular.ttf",
    fontUrl: ENGLISH_FONT_URL,
    cacheRef,
  });
};

const urlToDataUrl = async (url) => {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    return "";
  }
  try {
    const response = await fetch(safeUrl);
    if (!response.ok) {
      return "";
    }
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (_error) {
    return "";
  }
};

const hasKhmerChars = (value) => /[\u1780-\u17FF]/.test(String(value || ""));
const stripKhmerChars = (value) => String(value || "").replace(/[\u1780-\u17FF]/g, "");
const toTitleCaseWords = (value) =>
  String(value || "")
    .split(" ")
    .map((entry) => (entry ? `${entry[0].toUpperCase()}${entry.slice(1).toLowerCase()}` : ""))
    .join(" ")
    .trim();
const toProfessionalTitleCase = (value) => {
  const normalized = sanitizeCvEnglishText(value);
  if (!normalized) {
    return "";
  }
  return toTitleCaseWords(normalized);
};
const toProfessionalSkillLabel = (skill) => {
  const raw =
    typeof skill === "object" && skill !== null
      ? String(skill.label || skill.name || skill.title || skill.key || "")
      : String(skill || "").trim();
  if (!raw) {
    return "";
  }
  const normalizedKey = raw.toLowerCase().replace(/\s+/g, "_");
  if (SKILL_LABEL_OVERRIDES[normalizedKey]) {
    return SKILL_LABEL_OVERRIDES[normalizedKey];
  }
  return toTitleCaseWords(raw.replace(/[_-]+/g, " "));
};
const getNormalizedSkillKey = (skill) =>
  String(
    (typeof skill === "object" && skill !== null
      ? skill.key || skill.label || skill.name || skill.title || ""
      : skill) || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
const isSoftSkill = (skill) => SOFT_SKILL_KEYS.has(getNormalizedSkillKey(skill));
const normalizeCvSkillEntry = (skill, index = 0) => {
  const label = toProfessionalSkillLabel(skill);
  if (!label) {
    return null;
  }
  const normalizedKey = getNormalizedSkillKey(skill) || `skill_${index}`;
  return {
    id: `${normalizedKey}_${index}`,
    key: normalizedKey,
    label,
    isVerified: Boolean(typeof skill === "object" && skill !== null && skill.isVerified),
    group: isSoftSkill(skill) ? "soft" : "hard",
  };
};
const groupCvSkills = (skills) => {
  const normalizedSkills = (Array.isArray(skills) ? skills : [])
    .map((skill, index) => normalizeCvSkillEntry(skill, index))
    .filter(Boolean);
  return {
    hard: normalizedSkills.filter((skill) => skill.group === "hard"),
    soft: normalizedSkills.filter((skill) => skill.group === "soft"),
  };
};
const sanitizeCvEnglishText = (value) =>
  stripKhmerChars(String(value || "").replace(/[_-]+/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const formatEnglishMonthYear = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
};
const CV_INPUT_FONT_STYLE = { fontFamily: "\"Inter\", \"Roboto\", \"Segoe UI\", sans-serif" };
const CV_PREVIEW_A4_WIDTH = 794;
const CV_PREVIEW_A4_HEIGHT = 1123;
const normalizeMonthYearInput = (value) =>
  String(value || "")
    .replace(/[^\d/]/g, "")
    .slice(0, 7);
const normalizePlaceholderDate = (value) => {
  const normalized = sanitizeCvEnglishText(value);
  if (!normalized) {
    return "";
  }
  const lowered = normalized.toLowerCase();
  if (["mm/yyyy", "end date", "present", "start date"].includes(lowered)) {
    return "";
  }
  return normalized;
};
const buildProfileFormState = (user) => ({
  phoneNumber: user?.phoneNumber || "",
  telegramUsername: user?.telegramUsername || "",
  businessPhoneNumber: user?.businessPhoneNumber || "",
  businessTelegramUsername: user?.businessTelegramUsername || "",
  preferredContactMethod: user?.preferredContactMethod || "none",
  bio: user?.bio || "",
  university: user?.university || "",
  school: user?.school || "",
  companyName: user?.companyName || "",
  companyLogo: user?.companyLogo || "",
  companyCoverPicture: user?.companyCoverPicture || "",
  companyWebsite: user?.companyWebsite || "",
  companyAddress: user?.companyAddress || user?.companyLocation?.address || "",
  companySize: user?.companySize || "",
  businessRegistration: user?.businessRegistration || "",
  companyDescription: user?.companyDescription || "",
});
const serializeEducationEntry = (title, startDate = "", endDate = "") => {
  const safeTitle = sanitizeCvEnglishText(title);
  const safeStartDate = normalizePlaceholderDate(startDate);
  const safeEndDate = normalizePlaceholderDate(endDate);
  if (!safeTitle) {
    return "";
  }
  if (!safeStartDate && !safeEndDate) {
    return safeTitle;
  }
  return `${safeTitle} (${safeStartDate} - ${safeEndDate})`;
};
const parseEducationEntry = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)(?:\s*\(([^()]*)\))?$/);
  const rawTitle = sanitizeCvEnglishText(match?.[1] || text);
  const rawDateRange = String(match?.[2] || "").trim();
  const dateMatch = rawDateRange.match(/^([^()]*)\s*-\s*([^()]*)$/);
  return {
    title: rawTitle,
    startDate: normalizePlaceholderDate(dateMatch?.[1] || ""),
    endDate: normalizePlaceholderDate(dateMatch?.[2] || ""),
  };
};
const withPendingCvEntries = ({
  formState,
  experienceTitleInput,
  experienceStartDateInput,
  experienceEndDateInput,
  educationTitleInput,
  educationStartDateInput,
  educationEndDateInput,
}) => {
  const nextFormState = {
    ...formState,
    workExperiences: Array.isArray(formState?.workExperiences) ? [...formState.workExperiences] : [],
  };

  const pendingExperienceTitle = String(experienceTitleInput || "").trim();
  const pendingExperienceStartDate = normalizeMonthYearInput(experienceStartDateInput);
  const pendingExperienceEndDate = normalizeMonthYearInput(experienceEndDateInput);
  if (pendingExperienceTitle) {
    nextFormState.workExperiences = [
      ...nextFormState.workExperiences,
      {
        jobTitle: toProfessionalTitleCase(pendingExperienceTitle),
        bulletPoints: [],
        startDate: pendingExperienceStartDate,
        endDate: pendingExperienceEndDate,
        aiKeywords: [],
      },
    ];
  }

  const existingEducationEntries = String(formState?.educationHistory || "")
    .split("\n")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  const pendingEducationEntry = serializeEducationEntry(
    educationTitleInput,
    normalizeMonthYearInput(educationStartDateInput),
    normalizeMonthYearInput(educationEndDateInput)
  );
  nextFormState.educationHistory = pendingEducationEntry
    ? [...existingEducationEntries, pendingEducationEntry].join("\n")
    : existingEducationEntries.join("\n");

  return nextFormState;
};
const parseMonthYear = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12 || year < 1900 || year > 3000) {
    return null;
  }
  return { month, year };
};
const inferExperienceLevel = (startDate, endDate) => {
  const start = parseMonthYear(startDate);
  if (!start) {
    return "entry";
  }
  const endParsed = parseMonthYear(endDate);
  const now = new Date();
  const endMonth = endParsed ? endParsed.month : now.getMonth() + 1;
  const endYear = endParsed ? endParsed.year : now.getFullYear();
  const months = Math.max(0, (endYear - start.year) * 12 + (endMonth - start.month));
  if (months >= 72) {
    return "senior";
  }
  if (months >= 24) {
    return "mid";
  }
  return "entry";
};
const getExperienceAiScore = (experience) => {
  const bullets = Array.isArray(experience?.bulletPoints) ? experience.bulletPoints : [];
  const descriptionText = bullets.join(" ");
  const lengthScore = Math.min(45, Math.floor(descriptionText.length / 4));
  const verbHits = bullets.filter((line) => /^(Managed|Optimized|Delivered)\b/i.test(String(line || "").trim())).length;
  const verbScore = Math.min(30, verbHits * 10);
  const qualityScore = /\b(improved|increased|reduced|delivered|optimized|managed)\b/i.test(descriptionText) ? 15 : 0;
  const structureScore = bullets.length >= 3 ? 10 : bullets.length >= 2 ? 5 : 0;
  const score = Math.max(0, Math.min(100, lengthScore + verbScore + qualityScore + structureScore));
  const isHighQuality = score >= 75;
  return { score, isHighQuality };
};

const getTrustMeta = (score) => {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));
  if (normalized >= 80) {
    return { level: "Gold", color: "#10b981", progress: normalized };
  }
  if (normalized >= 40) {
    return { level: "Silver", color: "#2563eb", progress: normalized };
  }
  return { level: "Bronze", color: "#4f46e5", progress: normalized };
};

const CAMBODIA_EDU_OPTIONS = [
  "Royal University of Phnom Penh (RUPP)",
  "Institute of Technology of Cambodia (ITC)",
  "National University of Management (NUM)",
  "Royal University of Law and Economics (RULE)",
  "University of Puthisastra (UP)",
  "CamTech University",
  "Paragon International University",
  "American University of Phnom Penh (AUPP)",
  "Beltei International University",
  "Build Bright University (BBU)",
  "Norton University",
  "Western University",
  "Pannasastra University of Cambodia (PUC)",
  "University of Cambodia (UC)",
  "Limkokwing University Cambodia",
  "National University of Battambang (NUBB)",
  "Svay Rieng University",
  "Chea Sim University of Kamchaymear",
  "Liger Leadership Academy",
  "National Polytechnic Institute of Cambodia (NPIC)",
];

const ONBOARDING_SKILLS = [
  "Delivery",
  "Cleaning",
  "Construction",
  "IT/Digital",
  "Teaching",
  "Event Staff",
];
const CATEGORY_KEY_TO_LABEL = ONBOARDING_SKILLS.reduce((acc, category) => {
  acc[toSkillKey(category)] = category;
  return acc;
}, {});

const PHNOM_PENH_ZONES = [
  "Daun Penh",
  "Chamkar Mon",
  "7 Makara",
  "Toul Kork",
  "Sen Sok",
  "Russey Keo",
  "Meanchey",
  "Chbar Ampov",
  "Dangkor",
  "Por Senchey",
];

const COMPANY_SIZE_OPTIONS = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

function ProfilePage() {
  const { user, token, refreshCurrentUser, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [logError, setLogError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [previewPicture, setPreviewPicture] = useState("");
  const [selectedPictureFile, setSelectedPictureFile] = useState(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [selectedCompanyLogoFile, setSelectedCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState("");
  const [isUploadingCompanyLogo, setIsUploadingCompanyLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [selectedCompanyCoverFile, setSelectedCompanyCoverFile] = useState(null);
  const [companyCoverPreview, setCompanyCoverPreview] = useState("");
  const [isUploadingCompanyCover, setIsUploadingCompanyCover] = useState(false);
  const [showCompanyPreview, setShowCompanyPreview] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingSkills, setOnboardingSkills] = useState([]);
  const [onboardingAdvancedSkills, setOnboardingAdvancedSkills] = useState([]);
  const [onboardingLocation, setOnboardingLocation] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState(false);
  const [onboardingShake, setOnboardingShake] = useState(false);
  const fileInputRef = useRef(null);
  const companyLogoInputRef = useRef(null);
  const companyCoverInputRef = useRef(null);
  const [form, setForm] = useState({
    phoneNumber: "",
    telegramUsername: "",
    businessPhoneNumber: "",
    businessTelegramUsername: "",
    preferredContactMethod: "none",
    bio: "",
    university: "",
    school: "",
    companyName: "",
    companyLogo: "",
    companyCoverPicture: "",
    companyWebsite: "",
    companyAddress: "",
    companySize: "",
    businessRegistration: "",
    companyDescription: "",
  });
  const [showCvReviewModal, setShowCvReviewModal] = useState(false);
  const [showCvPreviewModal, setShowCvPreviewModal] = useState(false);
  const [isGeneratingCv, setIsGeneratingCv] = useState(false);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [isRefiningSummary, setIsRefiningSummary] = useState(false);
  const [isGeneratingAiExperience, setIsGeneratingAiExperience] = useState(false);
  const [aiExperienceLoadingIndex, setAiExperienceLoadingIndex] = useState(null);
  const [aiHealth, setAiHealth] = useState({ score: 0, tip: "" });
  const [isAiHealthLoading, setIsAiHealthLoading] = useState(false);
  const [aiSlowMessage, setAiSlowMessage] = useState("");
  const [cvReviewWarning, setCvReviewWarning] = useState("");
  const [cvSkillInput, setCvSkillInput] = useState("");
  const [cvSelectedCategory, setCvSelectedCategory] = useState("");
  const [showCvSkillAiTip, setShowCvSkillAiTip] = useState(false);
  const [showProfileSkillAiTip, setShowProfileSkillAiTip] = useState(false);
  const [profileSkillInput, setProfileSkillInput] = useState("");
  const [profileCategoryInput, setProfileCategoryInput] = useState("");
  const [catalogSkills, setCatalogSkills] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [newlyCreatedProfileSkillKeys, setNewlyCreatedProfileSkillKeys] = useState([]);
  const [cvLanguageInput, setCvLanguageInput] = useState("");
  const [cvExperienceTitleInput, setCvExperienceTitleInput] = useState("");
  const [cvExperienceStartDateInput, setCvExperienceStartDateInput] = useState("");
  const [cvExperienceEndDateInput, setCvExperienceEndDateInput] = useState("");
  const [cvEducationTitleInput, setCvEducationTitleInput] = useState("");
  const [cvEducationStartDateInput, setCvEducationStartDateInput] = useState("");
  const [cvEducationEndDateInput, setCvEducationEndDateInput] = useState("");
  const [cvPreviewScale, setCvPreviewScale] = useState(0.65);
  const cvHealthTimeoutRef = useRef(null);
  const aiPendingRequestsRef = useRef(0);
  const [cvReviewForm, setCvReviewForm] = useState({
    fullName: "",
    phoneNumber: "",
    professionalSummary: "",
    educationHistory: "",
    languages: [],
    skills: [],
    workExperiences: [],
  });

  const isEmployer = user?.role === "employer";
  const trustScore = Number(user?.trustScore || 0);
  const trustMeta = useMemo(() => getTrustMeta(trustScore), [trustScore]);
  const currentLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const activeLanguageCode = currentLanguage;
  const [educationFocusField, setEducationFocusField] = useState("");
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const handshakeTimelineKeys = useMemo(
    () => ["pending", "contracted", "awaiting_confirmation", "completed"],
    []
  );

  const isVerified = isEmployer
    ? Boolean(
        String(user?.businessPhoneNumber || "").trim() &&
          String(user?.businessTelegramUsername || "").trim()
      )
    : Boolean(
        String(user?.phoneNumber || "").trim() && String(user?.telegramUsername || "").trim()
      );
  const candidateSkills = useMemo(() => {
    if (isEmployer) {
      return [];
    }
    const list = Array.isArray(user?.skills) ? user.skills : [];
    return list
      .map((skill) => (typeof skill === "string" ? skill : String(skill?.name || "")))
      .map((skill) => skill.trim())
      .filter(Boolean);
  }, [isEmployer, user?.skills]);
  const candidateCategories = useMemo(() => {
    if (isEmployer) {
      return [];
    }
    const list = Array.isArray(user?.preferredCategories) && user.preferredCategories.length
      ? user.preferredCategories
      : String(user?.preferredCategory || "").trim()
        ? [String(user.preferredCategory).trim()]
        : [];
    return list
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .slice(0, 2);
  }, [isEmployer, user?.preferredCategories, user?.preferredCategory]);
  const cvAvailableSkillSuggestions = useMemo(() => {
    const normalizedCategory = toSkillKey(cvSelectedCategory || candidateCategories[0] || "");
    const categoryLabel = CATEGORY_KEY_TO_LABEL[normalizedCategory] || cvSelectedCategory || candidateCategories[0] || "";
    const suggestions = categoryLabel ? SKILL_SUGGESTIONS_BY_CATEGORY[categoryLabel] || [] : [];
    return Array.from(
      new Set(suggestions.map((entry) => toProfessionalSkillLabel(entry)).filter(Boolean))
    ).slice(0, 16);
  }, [candidateCategories, cvSelectedCategory]);
  const candidateExperience = useMemo(() => {
    if (isEmployer) {
      return [];
    }
    return logs
      .map((entry) => ({
        title: String(entry?.jobId?.title || "").trim(),
        location: String(entry?.jobId?.location?.address || "").trim(),
        date: entry?.handshakeAt || entry?.updatedAt || "",
      }))
      .filter((entry) => entry.title)
      .slice(0, 6);
  }, [isEmployer, logs]);
  const availableProfileCategories = useMemo(() => {
    const base = ONBOARDING_SKILLS.map((entry) => ({ key: toSkillKey(entry), label: entry }));
    const merged = [...base, ...(Array.isArray(catalogCategories) ? catalogCategories : [])];
    const seen = new Set();
    return merged.filter((entry) => {
      const key = toSkillKey(entry?.key || entry?.label || "");
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [catalogCategories]);
  const activeProfileCategoryLabel =
    onboardingSkills[0] ||
    availableProfileCategories.find((entry) => toSkillKey(entry.key) === toSkillKey(profileCategoryInput))?.label ||
    "";
  const filteredProfileCategorySuggestions = useMemo(() => {
    const query = toSkillKey(profileCategoryInput);
    if (!query) {
      return availableProfileCategories.slice(0, 8);
    }
    return availableProfileCategories
      .filter((entry) => toSkillKey(entry.label).includes(query))
      .slice(0, 8);
  }, [availableProfileCategories, profileCategoryInput]);
  const filteredProfileSkillSuggestions = useMemo(() => {
    const categorySkills = activeProfileCategoryLabel
      ? SKILL_SUGGESTIONS_BY_CATEGORY[activeProfileCategoryLabel] || []
      : [];
    const merged = [
      ...categorySkills.map((entry) => ({ key: toSkillKey(entry), label: toProfessionalSkillLabel(entry) })),
      ...(Array.isArray(catalogSkills) ? catalogSkills : []),
    ];
    const seen = new Set();
    const deduped = merged.filter((entry) => {
      const key = toSkillKey(entry?.key || entry?.label || "");
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    const query = toSkillKey(profileSkillInput);
    return deduped
      .filter((entry) => !query || toSkillKey(entry.label).includes(query))
      .slice(0, 10);
  }, [activeProfileCategoryLabel, catalogSkills, profileSkillInput]);

  useEffect(() => {
    if (!showCvReviewModal && !showCvPreviewModal) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCvPreviewModal, showCvReviewModal]);

  useEffect(() => {
    if (!showCvPreviewModal) {
      return undefined;
    }

    const updateCvScale = () => {
      const viewportWidth = window.innerWidth || 1200;
      const viewportHeight = window.innerHeight || 800;
      const isMobile = viewportWidth < 640;
      const horizontalPadding = isMobile ? 16 : 56;
      const verticalReserved = isMobile ? 258 : 220;
      const availableWidth = Math.max(220, viewportWidth - horizontalPadding);
      const availableHeight = Math.max(260, viewportHeight - verticalReserved);
      const scaleByWidth = availableWidth / CV_PREVIEW_A4_WIDTH;
      const scaleByHeight = availableHeight / CV_PREVIEW_A4_HEIGHT;
      const nextScale = Math.max(
        isMobile ? 0.24 : 0.36,
        Math.min(isMobile ? 0.5 : 1, Math.min(scaleByWidth, scaleByHeight))
      );
      setCvPreviewScale(Number(nextScale.toFixed(3)));
    };

    updateCvScale();
    window.addEventListener("resize", updateCvScale);
    return () => {
      window.removeEventListener("resize", updateCvScale);
    };
  }, [showCvPreviewModal]);

  useEffect(() => {
    if (!isEmployer) {
      setShowCompanyPreview(false);
      return;
    }

    const hasCompanyData = Boolean(
      String(user?.companyName || "").trim() ||
        String(user?.companyAddress || "").trim() ||
        String(user?.businessPhoneNumber || "").trim() ||
        String(user?.businessTelegramUsername || "").trim()
    );
    setShowCompanyPreview(hasCompanyData);
  }, [
    isEmployer,
    user?.companyAddress,
    user?.companyName,
    user?.businessPhoneNumber,
    user?.businessTelegramUsername,
  ]);

  useEffect(() => {
    if (!token) {
      setCatalogSkills([]);
      setCatalogCategories([]);
      return;
    }

    const fetchCatalog = async () => {
      try {
        setIsCatalogLoading(true);
        const response = await fetch(`${API_BASE_URL}/auth/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load profile catalog");
        }
        setCatalogSkills(
          Array.isArray(data.skills)
            ? data.skills.map((entry) => ({
                key: toSkillKey(entry?.key || entry?.label || ""),
                label: toProfessionalSkillLabel(entry?.label || entry?.key || ""),
              }))
            : []
        );
        setCatalogCategories(
          Array.isArray(data.categories)
            ? data.categories.map((entry) => ({
                key: toSkillKey(entry?.key || entry?.label || ""),
                label: toProfessionalTitleCase(entry?.label || entry?.key || ""),
              }))
            : []
        );
      } catch (_error) {
        setCatalogSkills([]);
        setCatalogCategories([]);
      } finally {
        setIsCatalogLoading(false);
      }
    };

    fetchCatalog();
  }, [token]);

  useEffect(() => {
    const role = String(user?.role || user?.accountType || "").toLowerCase();
    const isCandidate = role === "candidate";
    if (!isCandidate) {
      setOnboardingSkills([]);
      setOnboardingAdvancedSkills([]);
      setOnboardingLocation("");
      setShowOnboardingModal(false);
      return;
    }

    const savedSkills = Array.isArray(user?.preferredCategories)
      ? user.preferredCategories.map((entry) => String(entry || "").trim()).filter(Boolean)
      : String(user?.preferredCategory || "").trim()
        ? [String(user.preferredCategory).trim()]
        : [];
    const normalizedSavedCategories = savedSkills
      .map((entry) => CATEGORY_KEY_TO_LABEL[toSkillKey(entry)] || entry)
      .filter(Boolean)
      .slice(0, 2);
    const savedLocation = String(user?.preferredLocation || "").trim();
    const firstLogin = Boolean(user?.isFirstLogin);
    const onboardingIncomplete = normalizedSavedCategories.length < 1 || !savedLocation;

    setOnboardingSkills(normalizedSavedCategories);
    const savedSkillKeys = Array.isArray(user?.skills)
      ? user.skills.map((entry) => toSkillKey(entry)).filter(Boolean)
      : [];
    setOnboardingAdvancedSkills(savedSkillKeys);
    setOnboardingLocation(savedLocation);
    setOnboardingError("");
    setOnboardingShake(false);

    if (!firstLogin && !onboardingIncomplete) {
      setShowOnboardingModal(false);
      return;
    }
    setShowOnboardingModal(true);
  }, [
    user?.accountType,
    user?.isFirstLogin,
    user?.preferredCategory,
    user?.preferredCategories,
    user?.preferredLocation,
    user?.role,
    user?.skills,
  ]);

  useEffect(() => {
    setProfileCategoryInput(activeProfileCategoryLabel);
  }, [activeProfileCategoryLabel]);

  useEffect(() => {
    setForm(buildProfileFormState(user));
  }, [user]);

  useEffect(() => {
    if (isEmployer) {
      setLogs([]);
      setLogError("");
      return;
    }

    const fetchLogs = async () => {
      try {
        setLogError("");
        const response = await fetch(`${API_BASE_URL}/applications/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch handshake logs");
        }

        const completedLogs = (data.applications || []).filter(
          (application) => application.handshakeCompleted
        );
        setLogs(completedLogs);
      } catch (error) {
        setLogError(error.message);
      }
    };

    fetchLogs();
  }, [currentLanguage, isEmployer, token]);

  useEffect(() => {
    refreshCurrentUser().catch(() => {});
  }, [currentLanguage, refreshCurrentUser]);

  useEffect(() => {
    setAnimatedProgress(0);
    const timer = window.setTimeout(() => setAnimatedProgress(trustMeta.progress), 120);
    return () => window.clearTimeout(timer);
  }, [trustMeta.progress]);

  const circumference = 2 * Math.PI * 52;
  const strokeOffset = circumference * (1 - animatedProgress / 100);
  const imageBaseUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    return apiBase.replace(/\/api\/?$/, "");
  }, []);
  const profilePictureUrl = useMemo(() => {
    if (previewPicture) {
      return previewPicture;
    }
    const picture = String(user?.profilePicture || "").trim();
    if (!picture) {
      return "";
    }
    if (picture.startsWith("http://") || picture.startsWith("https://")) {
      return picture.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
    }
    return `${imageBaseUrl}${picture.startsWith("/") ? picture : `/${picture}`}`;
  }, [imageBaseUrl, previewPicture, user?.profilePicture]);
  const companyLogoDisplayUrl = useMemo(() => {
    if (companyLogoPreview) {
      return companyLogoPreview;
    }
    const logo = String(form.companyLogo || "").trim();
    if (!logo) {
      return "";
    }
    if (logo.startsWith("http://") || logo.startsWith("https://")) {
      return logo.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
    }
    return `${imageBaseUrl}${logo.startsWith("/") ? logo : `/${logo}`}`;
  }, [companyLogoPreview, form.companyLogo, imageBaseUrl]);

  const companyCoverDisplayUrl = useMemo(() => {
    if (companyCoverPreview) {
      return companyCoverPreview;
    }
    const cover = String(form.companyCoverPicture || "").trim();
    if (!cover) {
      return "";
    }
    if (cover.startsWith("http://") || cover.startsWith("https://")) {
      return cover.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
    }
    return `${imageBaseUrl}${cover.startsWith("/") ? cover : `/${cover}`}`;
  }, [companyCoverPreview, form.companyCoverPicture, imageBaseUrl]);

  const handleProfileChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetProfileDraft = () => {
    setForm(buildProfileFormState(user));
    setProfileError("");
    setProfileSuccess("");
    setProfileSkillInput("");
    setProfileCategoryInput("");
    setShowProfileSkillAiTip(false);
    setNewlyCreatedProfileSkillKeys([]);
    setSelectedPictureFile(null);
    if (previewPicture?.startsWith("blob:")) {
      URL.revokeObjectURL(previewPicture);
    }
    setPreviewPicture("");
    setSelectedCompanyLogoFile(null);
    if (companyLogoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(companyLogoPreview);
    }
    setCompanyLogoPreview("");
    setSelectedCompanyCoverFile(null);
    if (companyCoverPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(companyCoverPreview);
    }
    setCompanyCoverPreview("");
    setLogoUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (companyLogoInputRef.current) {
      companyLogoInputRef.current.value = "";
    }
    if (companyCoverInputRef.current) {
      companyCoverInputRef.current.value = "";
    }
    const restoredCategories =
      Array.isArray(user?.preferredCategories) && user.preferredCategories.length
        ? user.preferredCategories.map((entry) => String(entry || "").trim()).filter(Boolean)
        : String(user?.preferredCategory || "").trim()
          ? [String(user.preferredCategory).trim()]
          : [];
    setOnboardingSkills(
      restoredCategories
        .map((entry) => CATEGORY_KEY_TO_LABEL[toSkillKey(entry)] || entry)
        .filter(Boolean)
        .slice(0, 2)
    );
    setOnboardingAdvancedSkills(
      Array.isArray(user?.skills) ? user.skills.map((entry) => toSkillKey(entry)).filter(Boolean) : []
    );
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    try {
      setIsSavingProfile(true);
      setProfileError("");
      setProfileSuccess("");

      let response;
      if (isEmployer) {
        const formData = new FormData();
        formData.append("companyName", form.companyName || "");
        formData.append("companyWebsite", form.companyWebsite || "");
        formData.append("companyAddress", form.companyAddress || "");
        formData.append("companySize", form.companySize || "");
        formData.append("businessRegistration", form.businessRegistration || "");
        formData.append("companyDescription", form.companyDescription || "");
        formData.append("preferredContactMethod", form.preferredContactMethod || "none");
        formData.append("businessPhoneNumber", form.businessPhoneNumber || "");
        formData.append("businessTelegramUsername", form.businessTelegramUsername || "");
        if (selectedCompanyLogoFile) {
          formData.append("companyLogo", selectedCompanyLogoFile);
        }

        response = await fetch(`${API_BASE_URL}/users/employer/profile`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        const payload = {
          phoneNumber: form.phoneNumber,
          telegramUsername: form.telegramUsername,
          preferredContactMethod: form.preferredContactMethod,
          bio: form.bio,
          university: form.university,
          school: form.school,
          preferredCategories: onboardingSkills.slice(0, 2).map((entry) => toSkillKey(entry)),
          preferredCategory: toSkillKey(onboardingSkills[0] || ""),
          skills: onboardingAdvancedSkills.map((entry) => toSkillKey(entry)).filter(Boolean),
        };

        response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("profile.failedUpdate", { defaultValue: "Failed to update profile" }));
      }

      if (isEmployer) {
        const uploadedLogo = String(data.user?.companyLogo || "").trim();
        if (uploadedLogo) {
          setForm((prev) => ({ ...prev, companyLogo: uploadedLogo }));
        }
        setShowCompanyPreview(true);
        setSelectedCompanyLogoFile(null);
        setLogoUploadProgress(0);
        if (companyLogoInputRef.current) {
          companyLogoInputRef.current.value = "";
        }
      }

      await refreshCurrentUser();
      setProfileSuccess(
        isEmployer
          ? t("profile.companySettingsUpdated", { defaultValue: "Company settings updated." })
          : t("profile.updatedSuccess", { defaultValue: "Profile updated successfully." })
      );
      toastSuccess(
        isEmployer
          ? t("profile.companySettingsUpdatedShort", { defaultValue: "Company settings updated" })
          : t("profile.updatedShort", { defaultValue: "Profile updated" })
      );
      setSavePulse(true);
      setTimeout(() => setSavePulse(false), 500);
      setTimeout(() => setProfileSuccess(""), 2500);
      setShowProfileSkillAiTip(false);
      setIsEditing(false);
    } catch (error) {
      setProfileError(error.message);
      toastError(error.message || t("profile.failedUpdate", { defaultValue: "Failed to update profile" }));
    } finally {
      setIsSavingProfile(false);
    }
  };
  const verifiedApplicationsCount = Number(user?.verifiedApplicationsCount || logs.length || 0);
  const educationSuggestions = useMemo(() => {
    if (isEmployer || !educationFocusField) {
      return [];
    }
    const query = String(form[educationFocusField] || "").trim().toLowerCase();
    if (query.length < 3 || query.length > 5) {
      return [];
    }
    return CAMBODIA_EDU_OPTIONS.filter((item) => item.toLowerCase().includes(query)).slice(0, 7);
  }, [educationFocusField, form, isEmployer]);

  const handleEducationPick = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setEducationFocusField("");
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handlePictureSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (previewPicture?.startsWith("blob:")) {
      URL.revokeObjectURL(previewPicture);
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedPictureFile(file);
    setPreviewPicture(previewUrl);
  };

  useEffect(() => {
    return () => {
      if (previewPicture?.startsWith("blob:")) {
        URL.revokeObjectURL(previewPicture);
      }
      if (companyLogoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(companyLogoPreview);
      }
      if (companyCoverPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(companyCoverPreview);
      }
    };
  }, [companyCoverPreview, companyLogoPreview, previewPicture]);

  const handleCompanyLogoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (companyLogoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(companyLogoPreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedCompanyLogoFile(file);
    setCompanyLogoPreview(previewUrl);
    setLogoUploadProgress(0);
  };

  const handleCompanyCoverSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (companyCoverPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(companyCoverPreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setSelectedCompanyCoverFile(file);
    setCompanyCoverPreview(previewUrl);
  };

  const handleCompanyCoverUpload = async () => {
    if (!selectedCompanyCoverFile) {
      return;
    }

    try {
      setIsUploadingCompanyCover(true);
      const formData = new FormData();
      formData.append("coverPicture", selectedCompanyCoverFile);
      const response = await fetch(`${API_BASE_URL}/users/cover-picture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to upload company cover");
      }

      const nextCover = String(data.user?.companyCoverPicture || "").trim();
      if (nextCover) {
        setForm((prev) => ({ ...prev, companyCoverPicture: nextCover }));
      }
      setSelectedCompanyCoverFile(null);
      if (companyCoverInputRef.current) {
        companyCoverInputRef.current.value = "";
      }
      await refreshCurrentUser();
      toastSuccess(t("profile.companyCoverUpdated", { defaultValue: "Company cover updated." }));
    } catch (error) {
      toastError(error.message || "Failed to upload company cover");
    } finally {
      setIsUploadingCompanyCover(false);
    }
  };

  const handleCompanyLogoUpload = async () => {
    if (!selectedCompanyLogoFile) {
      return;
    }

    try {
      setIsUploadingCompanyLogo(true);
      setLogoUploadProgress(12);
      const progressTimer = window.setInterval(() => {
        setLogoUploadProgress((prev) => (prev >= 90 ? prev : prev + 10));
      }, 170);

      const formData = new FormData();
      formData.append("companyLogo", selectedCompanyLogoFile);
      const response = await fetch(`${API_BASE_URL}/users/employer/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      window.clearInterval(progressTimer);

      if (!response.ok) {
        throw new Error(data.message || "Failed to upload company logo");
      }

      setLogoUploadProgress(100);
      const nextLogo = String(data.user?.companyLogo || "").trim();
      if (nextLogo) {
        setForm((prev) => ({ ...prev, companyLogo: nextLogo }));
      }
      setSelectedCompanyLogoFile(null);
      if (companyLogoInputRef.current) {
        companyLogoInputRef.current.value = "";
      }
      setTimeout(() => setLogoUploadProgress(0), 600);
      await refreshCurrentUser();
      toastSuccess(t("profile.companyLogoUpdated", { defaultValue: "Company logo updated." }));
    } catch (error) {
      setLogoUploadProgress(0);
      toastError(error.message || "Failed to upload company logo");
    } finally {
      setIsUploadingCompanyLogo(false);
    }
  };

  const handlePictureUpload = async () => {
    if (!selectedPictureFile) {
      return;
    }

    try {
      setIsUploadingPicture(true);
      const formData = new FormData();
      formData.append("profilePicture", selectedPictureFile);

      const response = await fetch(`${API_BASE_URL}/users/profile-picture`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t("profile.failedSavePicture", { defaultValue: "Failed to save profile picture" }));
      }

      await refreshCurrentUser();
      setSelectedPictureFile(null);
      setPreviewPicture("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toastSuccess(t("profile.imageUpdated", { defaultValue: "Profile Image Updated!" }));
    } catch (error) {
      toastError(error.message || t("profile.failedUploadPicture", { defaultValue: "Failed to upload profile picture" }));
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleOpenCvReviewModal = () => {
    const savedEducation = Array.isArray(user?.educationHistory)
      ? user.educationHistory.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    const defaultEducation = (savedEducation.length
      ? savedEducation
      : [String(form.university || "").trim(), String(form.school || "").trim()].filter(Boolean)
    ).join("\n");
    const savedWorkExperiences = Array.isArray(user?.workExperience)
      ? user.workExperience
          .map((entry) => ({
            jobTitle: toProfessionalTitleCase(entry?.jobTitle) || "Candidate Experience",
            bulletPoints: Array.isArray(entry?.bulletPoints)
              ? entry.bulletPoints.map((line) => sanitizeCvEnglishText(line)).filter(Boolean).slice(0, 8)
              : [],
            startDate: sanitizeCvEnglishText(entry?.startDate || ""),
            endDate: sanitizeCvEnglishText(entry?.endDate || ""),
            aiKeywords: [],
          }))
          .filter((entry) => entry.jobTitle || entry.bulletPoints.length)
      : [];
    const defaultWorkExperiences = savedWorkExperiences.length
      ? savedWorkExperiences
      : candidateExperience.map((entry) => {
          const dateLabel = formatEnglishMonthYear(entry.date);
          return {
            jobTitle: toProfessionalTitleCase(entry.title) || "Candidate Experience",
            bulletPoints: entry.location
              ? [`Delivered responsibilities across ${sanitizeCvEnglishText(entry.location)}.`]
              : ["Delivered responsibilities with consistent quality and reliability."],
            startDate: dateLabel,
            endDate: "Present",
            aiKeywords: [],
          };
        });
    setCvReviewForm({
      fullName: String(user?.name || "").trim(),
      phoneNumber: String(form.phoneNumber || "").trim(),
      professionalSummary: String(form.bio || "").slice(0, 200),
      educationHistory: defaultEducation,
      languages: Array.isArray(user?.languages)
        ? user.languages.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 12)
        : [],
      skills: candidateSkills.map((skill) => toProfessionalSkillLabel(skill)).filter(Boolean).slice(0, 20),
      workExperiences: defaultWorkExperiences,
    });
    setCvSelectedCategory(
      CATEGORY_KEY_TO_LABEL[toSkillKey(candidateCategories[0] || "")] || candidateCategories[0] || ""
    );
    setShowCvSkillAiTip(false);
    setAiHealth({ score: 0, tip: "" });
    setCvReviewWarning("");
    setCvSkillInput("");
    setCvLanguageInput("");
    setCvExperienceTitleInput("");
    setCvExperienceStartDateInput("");
    setCvExperienceEndDateInput("");
    setCvEducationTitleInput("");
    setCvEducationStartDateInput("");
    setCvEducationEndDateInput("");
    setShowCvReviewModal(true);
    setShowCvPreviewModal(false);
  };

  const handleOpenCvPreviewModal = (reset = false) => {
    if (reset) {
      handleOpenCvReviewModal();
    }
    setShowCvReviewModal(false);
    setShowCvPreviewModal(true);
  };

  const handleCloseCvReviewModal = () => {
    if (isGeneratingCv) {
      return;
    }
    setShowCvReviewModal(false);
    setCvReviewWarning("");
    setCvSkillInput("");
    setCvSelectedCategory(
      CATEGORY_KEY_TO_LABEL[toSkillKey(candidateCategories[0] || "")] || candidateCategories[0] || ""
    );
    setShowCvSkillAiTip(false);
    setCvLanguageInput("");
    setCvExperienceTitleInput("");
    setCvExperienceStartDateInput("");
    setCvExperienceEndDateInput("");
    setCvEducationTitleInput("");
    setCvEducationStartDateInput("");
    setCvEducationEndDateInput("");
    setAiSlowMessage("");
  };

  const handleCloseCvPreviewModal = () => {
    if (isGeneratingCv) {
      return;
    }
    setShowCvPreviewModal(false);
  };

  const handleCvReviewChange = (field, value) => {
    if (field === "phoneNumber") {
      handleProfileChange("phoneNumber", value);
    }
    if (field === "professionalSummary") {
      handleProfileChange("bio", value.slice(0, 200));
    }
    setCvReviewForm((prev) => ({ ...prev, [field]: value }));
    setCvReviewWarning("");
  };

  const addCvSkill = () => {
    const nextSkill = toProfessionalSkillLabel(cvSkillInput);
    if (!nextSkill) {
      return;
    }
    setCvReviewForm((prev) => {
      if (prev.skills.some((entry) => entry.toLowerCase() === nextSkill.toLowerCase())) {
        return prev;
      }
      return { ...prev, skills: [...prev.skills, nextSkill].slice(0, 30) };
    });
    setShowCvSkillAiTip(true);
    setCvSkillInput("");
  };

  const removeCvSkill = (skillToRemove) => {
    setCvReviewForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((entry) => entry !== skillToRemove),
    }));
    setShowCvSkillAiTip(true);
  };

  const handleAddSuggestedCvSkill = (skill) => {
    const nextSkill = toProfessionalSkillLabel(skill);
    if (!nextSkill) {
      return;
    }
    setCvReviewForm((prev) => {
      if (prev.skills.some((entry) => entry.toLowerCase() === nextSkill.toLowerCase())) {
        return prev;
      }
      return { ...prev, skills: [...prev.skills, nextSkill].slice(0, 30) };
    });
    setShowCvSkillAiTip(true);
  };

  const addCvLanguage = () => {
    const nextLanguage = sanitizeCvEnglishText(cvLanguageInput).slice(0, 60);
    if (!nextLanguage) {
      return;
    }
    setCvReviewForm((prev) => {
      if (prev.languages.some((entry) => entry.toLowerCase() === nextLanguage.toLowerCase())) {
        return prev;
      }
      return { ...prev, languages: [...prev.languages, nextLanguage].slice(0, 12) };
    });
    setCvLanguageInput("");
  };

  const removeCvLanguage = (languageToRemove) => {
    setCvReviewForm((prev) => ({
      ...prev,
      languages: prev.languages.filter((entry) => entry !== languageToRemove),
    }));
  };

  const addCvEducationEntry = () => {
    const nextEntry = serializeEducationEntry(
      cvEducationTitleInput,
      normalizeMonthYearInput(cvEducationStartDateInput),
      normalizeMonthYearInput(cvEducationEndDateInput)
    );
    if (!nextEntry) {
      return;
    }
    const currentEntries = String(cvReviewForm.educationHistory || "")
      .split("\n")
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
    setCvReviewForm((prev) => ({
      ...prev,
      educationHistory: [...currentEntries, nextEntry].slice(0, 20).join("\n"),
    }));
    setCvEducationTitleInput("");
    setCvEducationStartDateInput("");
    setCvEducationEndDateInput("");
  };

  const handleEducationHistoryEntryChange = (index, field, value) => {
    const entries = String(cvReviewForm.educationHistory || "")
      .split("\n")
      .map((entry) => parseEducationEntry(entry))
      .filter((entry) => entry.title || entry.startDate || entry.endDate);
    const nextEntries = entries.map((entry, entryIndex) => {
      if (entryIndex !== index) {
        return entry;
      }
      if (field === "title") {
        return { ...entry, title: sanitizeCvEnglishText(value) };
      }
      return { ...entry, [field]: normalizeMonthYearInput(value) };
    });
    setCvReviewForm((prev) => ({
      ...prev,
      educationHistory: nextEntries
        .map((entry) => serializeEducationEntry(entry.title, entry.startDate, entry.endDate))
        .filter(Boolean)
        .join("\n"),
    }));
  };

  const removeEducationHistoryEntry = (index) => {
    const entries = String(cvReviewForm.educationHistory || "")
      .split("\n")
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
    setCvReviewForm((prev) => ({
      ...prev,
      educationHistory: entries.filter((_, entryIndex) => entryIndex !== index).join("\n"),
    }));
  };

  const syncAiSummaryToProfile = async (summaryText) => {
    const nextBio = sanitizeCvEnglishText(summaryText).slice(0, 200);
    if (!nextBio) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phoneNumber: form.phoneNumber,
        telegramUsername: form.telegramUsername,
        preferredContactMethod: form.preferredContactMethod,
        bio: nextBio,
        university: form.university,
        school: form.school,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || t("profile.failedUpdate", { defaultValue: "Failed to update profile" }));
    }
    setForm((prev) => ({ ...prev, bio: nextBio }));
    await refreshCurrentUser();
  };

  const callCvAssist = async (mode, overrides = {}) => {
    aiPendingRequestsRef.current += 1;
    const slowTimer = window.setTimeout(() => {
      if (aiPendingRequestsRef.current > 0) {
        setAiSlowMessage(AI_SLOW_MESSAGE_KM);
      }
    }, 1200);

    try {
      const response = await fetch(`${AI_API_BASE_URL}/api/ai/cv-assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          language: "en",
          selectedCategory: cvSelectedCategory,
          selectedSkills: (cvReviewForm.skills.length ? cvReviewForm.skills : candidateSkills)
            .map((skill) => toProfessionalSkillLabel(skill))
            .filter(Boolean),
          userSkills: candidateSkills.map((skill) => toProfessionalSkillLabel(skill)).filter(Boolean),
          workExperience: cvReviewForm.workExperiences,
          professionalSummary: cvReviewForm.professionalSummary,
          ...overrides,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "AI service unavailable");
      }
      return data;
    } finally {
      window.clearTimeout(slowTimer);
      aiPendingRequestsRef.current = Math.max(0, aiPendingRequestsRef.current - 1);
      if (aiPendingRequestsRef.current === 0) {
        setAiSlowMessage("");
      }
    }
  };

  const handleGenerateAiSummary = async () => {
    try {
      setIsGeneratingAiSummary(true);
      const data = await callCvAssist("summary");
      const summaryText = String(data?.summary || "").trim();
      if (!summaryText) {
        return;
      }
      const sanitizedSummary = sanitizeCvEnglishText(summaryText).slice(0, 200);
      handleCvReviewChange("professionalSummary", sanitizedSummary);
      await syncAiSummaryToProfile(sanitizedSummary);
    } catch (error) {
      toastError(error.message || "Failed to generate summary");
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  const handleRefineSummary = async () => {
    const source = String(cvReviewForm.professionalSummary || "").trim();
    if (!source) {
      return;
    }
    try {
      setIsRefiningSummary(true);
      const data = await callCvAssist("refine", { inputText: source });
      const refined = String(data?.refinedText || "").trim();
      if (refined && refined !== source) {
        const sanitizedRefined = sanitizeCvEnglishText(refined).slice(0, 200);
        handleCvReviewChange("professionalSummary", sanitizedRefined);
        await syncAiSummaryToProfile(sanitizedRefined);
      }
    } catch (_error) {
      // Keep user flow smooth; refinement is optional.
    } finally {
      setIsRefiningSummary(false);
    }
  };

  const handleAddWorkExperience = async () => {
    const title = String(cvExperienceTitleInput || "").trim();
    const startDate = normalizeMonthYearInput(cvExperienceStartDateInput);
    const endDate = normalizeMonthYearInput(cvExperienceEndDateInput);
    if (!title) {
      return;
    }
    setIsGeneratingAiExperience(true);
    const newIndex = cvReviewForm.workExperiences.length;
    setAiExperienceLoadingIndex(newIndex);
    setCvReviewForm((prev) => ({
      ...prev,
      workExperiences: [
        ...prev.workExperiences,
        {
          jobTitle: toProfessionalTitleCase(title),
          bulletPoints: [],
          startDate,
          endDate,
          aiKeywords: [],
        },
      ],
    }));
    try {
      const data = await callCvAssist("experience", {
        jobTitle: title,
        selectedCategory: cvSelectedCategory,
        selectedSkills: (cvReviewForm.skills.length ? cvReviewForm.skills : candidateSkills)
          .map((skill) => toProfessionalSkillLabel(skill))
          .filter(Boolean),
        userSkills: candidateSkills.map((skill) => toProfessionalSkillLabel(skill)).filter(Boolean),
        experienceLevel: inferExperienceLevel(startDate, endDate),
        startDate,
        endDate,
      });
      const bulletPoints = Array.isArray(data?.bulletPoints)
        ? data.bulletPoints
            .map((entry) => sanitizeCvEnglishText(entry))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const keywords = Array.isArray(data?.keywords)
        ? data.keywords
            .map((entry) => toProfessionalTitleCase(entry))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      setCvReviewForm((prev) => ({
        ...prev,
        workExperiences: prev.workExperiences.map((entry, entryIndex) =>
          entryIndex === newIndex ? { ...entry, bulletPoints, aiKeywords: keywords } : entry
        ),
      }));
      setCvExperienceTitleInput("");
      setCvExperienceStartDateInput("");
      setCvExperienceEndDateInput("");
      setShowCvSkillAiTip(false);
    } catch (error) {
      setCvReviewForm((prev) => ({
        ...prev,
        workExperiences: prev.workExperiences.filter((_, entryIndex) => entryIndex !== newIndex),
      }));
      toastError(error.message || "Failed to generate work experience suggestions");
    } finally {
      setAiExperienceLoadingIndex(null);
      setIsGeneratingAiExperience(false);
    }
  };

  const handleWorkExperienceChange = (index, field, value) => {
    setCvReviewForm((prev) => ({
      ...prev,
      workExperiences: prev.workExperiences.map((entry, entryIndex) => {
        if (entryIndex !== index) {
          return entry;
        }
        if (field === "bulletText") {
          return {
            ...entry,
            bulletPoints: String(value || "")
              .split("\n")
              .map((line) => sanitizeCvEnglishText(line))
              .filter(Boolean)
              .slice(0, 8),
          };
        }
        if (field === "startDate" || field === "endDate") {
          return { ...entry, [field]: normalizeMonthYearInput(value) };
        }
        if (field === "jobTitle") {
          return { ...entry, jobTitle: toProfessionalTitleCase(value) };
        }
        return { ...entry, [field]: sanitizeCvEnglishText(value) };
      }),
    }));
  };

  const handleApplyExperienceKeyword = (index, keyword) => {
    const normalized = toProfessionalTitleCase(keyword);
    if (!normalized) {
      return;
    }
    setCvReviewForm((prev) => ({
      ...prev,
      workExperiences: prev.workExperiences.map((entry, entryIndex) => {
        if (entryIndex !== index) {
          return entry;
        }
        const existing = Array.isArray(entry.bulletPoints) ? entry.bulletPoints : [];
        const nextBullet = `Delivered ${normalized.toLowerCase()} outcomes with consistency and quality.`;
        if (existing.some((line) => line.toLowerCase().includes(normalized.toLowerCase()))) {
          return entry;
        }
        return { ...entry, bulletPoints: [...existing, nextBullet].slice(0, 8) };
      }),
    }));
  };

  const handleRemoveWorkExperience = (index) => {
    setCvReviewForm((prev) => ({
      ...prev,
      workExperiences: prev.workExperiences.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const handleRegenerateExperienceSuggestions = async (index) => {
    const target = cvReviewForm.workExperiences[index];
    const title = String(target?.jobTitle || "").trim();
    if (!title) {
      return;
    }
    setIsGeneratingAiExperience(true);
    setAiExperienceLoadingIndex(index);
    try {
      const data = await callCvAssist("experience", {
        jobTitle: title,
        selectedCategory: cvSelectedCategory,
        selectedSkills: (cvReviewForm.skills.length ? cvReviewForm.skills : candidateSkills)
          .map((skill) => toProfessionalSkillLabel(skill))
          .filter(Boolean),
        userSkills: candidateSkills.map((skill) => toProfessionalSkillLabel(skill)).filter(Boolean),
        experienceLevel: inferExperienceLevel(target?.startDate, target?.endDate),
      });
      const bulletPoints = Array.isArray(data?.bulletPoints)
        ? data.bulletPoints
            .map((entry) => sanitizeCvEnglishText(entry))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const keywords = Array.isArray(data?.keywords)
        ? data.keywords
            .map((entry) => toProfessionalTitleCase(entry))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      if (!bulletPoints.length) {
        return;
      }
      setCvReviewForm((prev) => ({
        ...prev,
        workExperiences: prev.workExperiences.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, bulletPoints, aiKeywords: keywords } : entry
        ),
      }));
      setShowCvSkillAiTip(false);
    } catch (error) {
      toastError(error.message || "Failed to generate suggestions");
    } finally {
      setAiExperienceLoadingIndex(null);
      setIsGeneratingAiExperience(false);
    }
  };

  const handleRefineExperienceBullets = async (index) => {
    const target = cvReviewForm.workExperiences[index];
    const source = Array.isArray(target?.bulletPoints) ? target.bulletPoints.join("\n") : "";
    if (!String(source || "").trim()) {
      return;
    }
    try {
      const data = await callCvAssist("refine", { inputText: source });
      const refined = String(data?.refinedText || "").trim();
      if (!refined) {
        return;
      }
      handleWorkExperienceChange(index, "bulletText", refined);
    } catch (_error) {
      // Keep manual editing uninterrupted.
    }
  };

  useEffect(() => {
    if (!showCvReviewModal) {
      return;
    }
    if (cvHealthTimeoutRef.current) {
      window.clearTimeout(cvHealthTimeoutRef.current);
    }
    cvHealthTimeoutRef.current = window.setTimeout(async () => {
      try {
        setIsAiHealthLoading(true);
        const data = await callCvAssist("health");
        const calculatedScore = Math.max(0, Math.min(100, Number(data?.score || 0)));
        const shortSummary = String(cvReviewForm.professionalSummary || "").trim().length < 80;
        const tipText =
          shortSummary || calculatedScore < 70
            ? "AI recommends adding your key achievements here"
            : String(data?.tip || "");
        setAiHealth({
          score: calculatedScore,
          tip: tipText,
        });
      } catch (_error) {
        setAiHealth({ score: 0, tip: "" });
      } finally {
        setIsAiHealthLoading(false);
      }
    }, 700);

    return () => {
      if (cvHealthTimeoutRef.current) {
        window.clearTimeout(cvHealthTimeoutRef.current);
      }
    };
  }, [
    showCvReviewModal,
    cvReviewForm.professionalSummary,
    cvReviewForm.skills,
    cvReviewForm.workExperiences,
  ]);

  const syncCandidateProfileForCv = async (overrideForm = null) => {
    const activeCvForm = overrideForm || cvReviewForm;
    const nextPhone = String(activeCvForm.phoneNumber || "").trim();
    const nextBio = String(activeCvForm.professionalSummary || "").trim().slice(0, 200);
    const nextEducation = String(activeCvForm.educationHistory || "")
      .split("\n")
      .map((entry) => parseEducationEntry(entry))
      .filter((entry) => entry.title || entry.startDate || entry.endDate)
      .map((entry) => serializeEducationEntry(entry.title, entry.startDate, entry.endDate))
      .filter(Boolean)
      .slice(0, 20);
    const nextLanguages = (Array.isArray(activeCvForm.languages) ? activeCvForm.languages : [])
      .map((entry) => sanitizeCvEnglishText(entry).slice(0, 60))
      .filter(Boolean)
      .slice(0, 12);
    const nextWorkExperience = (Array.isArray(activeCvForm.workExperiences)
      ? activeCvForm.workExperiences
      : []
    )
      .map((entry) => ({
        jobTitle: toProfessionalTitleCase(entry?.jobTitle || ""),
        bulletPoints: Array.isArray(entry?.bulletPoints)
          ? entry.bulletPoints.map((line) => sanitizeCvEnglishText(line)).filter(Boolean).slice(0, 8)
          : [],
        startDate: sanitizeCvEnglishText(entry?.startDate || ""),
        endDate: sanitizeCvEnglishText(entry?.endDate || ""),
      }))
      .filter((entry) => entry.jobTitle || entry.bulletPoints.length)
      .slice(0, 12);
    const currentPhone = String(user?.phoneNumber || "").trim();
    const currentBio = String(user?.bio || "").trim();
    const currentLanguages = Array.isArray(user?.languages) ? user.languages : [];
    const currentEducation = Array.isArray(user?.educationHistory) ? user.educationHistory : [];
    const currentWorkExperience = Array.isArray(user?.workExperience) ? user.workExperience : [];

    if (
      nextPhone === currentPhone &&
      nextBio === currentBio &&
      JSON.stringify(nextLanguages) === JSON.stringify(currentLanguages) &&
      JSON.stringify(nextEducation) === JSON.stringify(currentEducation) &&
      JSON.stringify(nextWorkExperience) === JSON.stringify(currentWorkExperience)
    ) {
      await refreshCurrentUser();
      return;
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phoneNumber: nextPhone,
        telegramUsername: form.telegramUsername,
        preferredContactMethod: form.preferredContactMethod,
        bio: nextBio,
        university: form.university,
        school: form.school,
        languages: nextLanguages,
        educationHistory: nextEducation,
        workExperience: nextWorkExperience,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || t("profile.failedUpdate", { defaultValue: "Failed to update profile" }));
    }
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const meData = await meResponse.json();
    if (!meResponse.ok) {
      throw new Error(meData.message || "Failed to refresh profile data");
    }

    setForm((prev) => ({
      ...prev,
      phoneNumber: nextPhone,
      bio: nextBio,
    }));
    const refreshedUser = meData?.user || data?.user || {};
    const refreshedLanguages = Array.isArray(refreshedUser.languages)
      ? refreshedUser.languages
      : nextLanguages;
    const refreshedEducation = Array.isArray(refreshedUser.educationHistory)
      ? refreshedUser.educationHistory
      : nextEducation;
    const refreshedWorkExperience = Array.isArray(refreshedUser.workExperience)
      ? refreshedUser.workExperience
      : nextWorkExperience;
    setCvReviewForm((prev) => ({
      ...prev,
      phoneNumber: String(refreshedUser.phoneNumber || nextPhone).trim(),
      professionalSummary: String(refreshedUser.bio || nextBio).slice(0, 200),
      languages: refreshedLanguages,
      educationHistory: refreshedEducation.join("\n"),
      workExperiences: refreshedWorkExperience.map((entry) => ({
        jobTitle: toProfessionalTitleCase(entry?.jobTitle || "Candidate Experience"),
        bulletPoints: Array.isArray(entry?.bulletPoints)
          ? entry.bulletPoints.map((line) => sanitizeCvEnglishText(line)).filter(Boolean).slice(0, 8)
          : [],
        startDate: sanitizeCvEnglishText(entry?.startDate || ""),
        endDate: sanitizeCvEnglishText(entry?.endDate || ""),
        aiKeywords: [],
      })),
    }));
    await refreshCurrentUser();
  };

  const handleSaveAndUpdateCvProfile = async () => {
    try {
      setIsGeneratingCv(true);
      setCvReviewWarning("");
      const nextCvReviewForm = withPendingCvEntries({
        formState: cvReviewForm,
        experienceTitleInput: cvExperienceTitleInput,
        experienceStartDateInput: cvExperienceStartDateInput,
        experienceEndDateInput: cvExperienceEndDateInput,
        educationTitleInput: cvEducationTitleInput,
        educationStartDateInput: cvEducationStartDateInput,
        educationEndDateInput: cvEducationEndDateInput,
      });
      setCvReviewForm(nextCvReviewForm);
      setCvExperienceTitleInput("");
      setCvExperienceStartDateInput("");
      setCvExperienceEndDateInput("");
      setCvEducationTitleInput("");
      setCvEducationStartDateInput("");
      setCvEducationEndDateInput("");
      await syncCandidateProfileForCv(nextCvReviewForm);
      toastSuccess("Saved successfully");
      setShowCvReviewModal(false);
      setShowCvPreviewModal(true);
    } catch (error) {
      toastError(error.message || "Failed to update profile");
    } finally {
      setIsGeneratingCv(false);
    }
  };

  const generateCandidateCvPdf = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const contentTop = 36;
    const contentBottom = pageHeight - 36;
    const contentWidth = pageWidth - margin * 2;
    const sidebarWidth = contentWidth * 0.3;
    const mainWidth = contentWidth * 0.7;
    const sidebarX = margin;
    const mainX = sidebarX + sidebarWidth;
    const profilePhotoSize = 82;
    const profileImageUrl = await urlToDataUrl(profilePictureUrl);

    const [khmerFontReady, englishFontReady] = await Promise.all([
      ensureKantumruyProFont(doc),
      ensureEnglishPdfFont(doc),
    ]);
    if (khmerFontReady) {
      doc.setFont("KantumruyPro", "normal");
    } else if (englishFontReady) {
      doc.setFont("Inter", "normal");
    }
    const setPdfFont = (text, style = "normal") => {
      if (khmerFontReady) {
        doc.setFont("KantumruyPro", "normal");
        return;
      }
      if (englishFontReady) {
        doc.setFont("Inter", "normal");
        return;
      }
      doc.setFont("helvetica", style);
    };
    const writeWrapped = (text, x, y, width, options = {}) => {
      const { fontSize = 10, color = [30, 41, 59], align = "left", lineHeight = 14 } = options;
      const safeText = sanitizeCvEnglishText(text);
      if (!safeText) {
        return y;
      }
      setPdfFont(safeText);
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(safeText, width);
      lines.forEach((line) => {
        doc.text(line, x, y, { maxWidth: width, align });
        y += lineHeight;
      });
      return y;
    };
    const writeBulletBlock = (text, x, y, width) => {
      const bulletX = x;
      const textX = x + 12;
      const textWidth = width - 12;
      const safeText = sanitizeCvEnglishText(text);
      if (!safeText) {
        return y;
      }
      setPdfFont(safeText);
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text("•", bulletX, y);
      const lines = doc.splitTextToSize(safeText, textWidth);
      lines.forEach((line, lineIndex) => {
        doc.text(line, textX, y + lineIndex * 14, {
          maxWidth: textWidth,
          align: lineIndex === lines.length - 1 ? "left" : "justify",
        });
      });
      return y + Math.max(16, lines.length * 14);
    };
    const drawSectionHeading = (title, x, y, width) => {
      setPdfFont(title, "bold");
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text(title, x, y);
      doc.setDrawColor(224, 231, 255);
      doc.setLineWidth(0.7);
      doc.line(x, y + 5, x + width, y + 5);
      return y + 18;
    };

    doc.setFillColor(243, 244, 246);
    doc.rect(sidebarX, contentTop, sidebarWidth, contentBottom - contentTop, "F");
    doc.setFillColor(255, 255, 255);
    doc.rect(mainX, contentTop, mainWidth, contentBottom - contentTop, "F");

    const headerHeight = 84;
    doc.setFillColor(248, 250, 252);
    doc.rect(mainX, contentTop, mainWidth, headerHeight, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.8);
    doc.line(mainX, contentTop + headerHeight, mainX + mainWidth, contentTop + headerHeight);

    let sidebarY = contentTop + 28;
    const sidebarCenterX = sidebarX + sidebarWidth / 2;
    if (profileImageUrl) {
      const imageFormat = profileImageUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(
        profileImageUrl,
        imageFormat,
        sidebarCenterX - profilePhotoSize / 2,
        sidebarY,
        profilePhotoSize,
        profilePhotoSize
      );
    } else {
      doc.setFillColor(226, 232, 240);
      doc.circle(sidebarCenterX, sidebarY + profilePhotoSize / 2, profilePhotoSize / 2, "F");
      const initials = String(cvReviewForm.fullName || "C")
        .split(" ")
        .map((entry) => entry[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(71, 85, 105);
      doc.text(initials || "C", sidebarCenterX, sidebarY + profilePhotoSize / 2 + 10, {
        align: "center",
      });
    }
    sidebarY += profilePhotoSize + 20;

    sidebarY = drawSectionHeading("Contact", sidebarX + 14, sidebarY, sidebarWidth - 28);
    sidebarY = writeWrapped(
      `Phone: ${String(cvReviewForm.phoneNumber || "").trim() || "-"}`,
      sidebarX + 14,
      sidebarY,
      sidebarWidth - 28,
      { fontSize: 10, lineHeight: 13 }
    );
    sidebarY = writeWrapped(
      `Email: ${String(user?.email || "").trim() || "-"}`,
      sidebarX + 14,
      sidebarY + 2,
      sidebarWidth - 28,
      { fontSize: 10, lineHeight: 13 }
    );
    sidebarY = writeWrapped(
      `Telegram: ${
        String(user?.telegramUsername || "").trim()
          ? `@${String(user?.telegramUsername || "").trim().replace(/^@/, "")}`
          : "-"
      }`,
      sidebarX + 14,
      sidebarY + 2,
      sidebarWidth - 28,
      { fontSize: 10, lineHeight: 13 }
    );

    const drawSkillGroupLabel = (labelText) => {
      setPdfFont(labelText, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(79, 70, 229);
      doc.text(labelText, sidebarX + 14, sidebarY);
      sidebarY += 14;
    };
    const drawSkillChip = (skill) => {
      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(224, 231, 255);
      const safeSkill = skill.label;
      if (!safeSkill) {
        return;
      }
      setPdfFont(safeSkill);
      doc.setFontSize(9.5);
      const verificationWidth = skill.isVerified ? 10 : 0;
      const textWidth = doc.getTextWidth(safeSkill);
      const tagWidth = Math.min(sidebarWidth - 28, textWidth + 18 + verificationWidth);
      doc.roundedRect(sidebarX + 14, sidebarY - 9, tagWidth, 16, 6, 6, "FD");
      doc.setTextColor(55, 48, 163);
      doc.text(safeSkill, sidebarX + 21, sidebarY + 2);
      if (skill.isVerified) {
        doc.setTextColor(37, 99, 235);
        doc.text("v", sidebarX + 21 + textWidth + 6, sidebarY + 2);
      }
      sidebarY += 20;
    };

    sidebarY += 8;
    sidebarY = drawSectionHeading("Skills", sidebarX + 14, sidebarY, sidebarWidth - 28);
    const groupedPdfSkills = groupCvSkills(cvReviewForm.skills);
    if (groupedPdfSkills.hard.length || groupedPdfSkills.soft.length) {
      if (groupedPdfSkills.hard.length) {
        drawSkillGroupLabel("Hard Skills");
        groupedPdfSkills.hard.forEach(drawSkillChip);
      }
      if (groupedPdfSkills.soft.length) {
        drawSkillGroupLabel("Soft Skills");
        groupedPdfSkills.soft.forEach(drawSkillChip);
      }
    } else {
      sidebarY = writeWrapped("No skills", sidebarX + 14, sidebarY, sidebarWidth - 28, {
        fontSize: 10,
        color: [100, 116, 139],
      });
    }

    sidebarY += 8;
    sidebarY = drawSectionHeading("Languages", sidebarX + 14, sidebarY, sidebarWidth - 28);
    sidebarY = writeWrapped(
      cvReviewForm.languages.length ? cvReviewForm.languages.join(", ") : "-",
      sidebarX + 14,
      sidebarY,
      sidebarWidth - 28,
      { fontSize: 10, lineHeight: 13 }
    );

    let mainY = contentTop + 28;
    setPdfFont(sanitizeCvEnglishText(cvReviewForm.fullName));
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeCvEnglishText(cvReviewForm.fullName) || "Candidate", mainX + 16, mainY);
    mainY += 22;
    setPdfFont("Professional Candidate");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("Professional Candidate", mainX + 16, mainY);

    if (isVerified) {
      const badgeText = "WorkCloud Verified";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const badgeWidth = doc.getTextWidth(badgeText) + 20;
      const badgeX = mainX + mainWidth - badgeWidth - 16;
      const badgeY = contentTop + 14;
      doc.setFillColor(79, 70, 229);
      doc.roundedRect(badgeX, badgeY, badgeWidth, 20, 6, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, badgeX + 10, badgeY + 13);
    }

    mainY = contentTop + headerHeight + 22;
    mainY = drawSectionHeading("Summary", mainX + 16, mainY, mainWidth - 32);
    mainY = writeWrapped(
      String(cvReviewForm.professionalSummary || "").trim(),
      mainX + 16,
      mainY,
      mainWidth - 32,
      { fontSize: 10.5, align: "justify", lineHeight: 14 }
    );
    mainY += 8;

    mainY = drawSectionHeading("Experience", mainX + 16, mainY, mainWidth - 32);
    if (cvReviewForm.workExperiences.length) {
      cvReviewForm.workExperiences.forEach((experience) => {
        const titleLine = toProfessionalTitleCase(experience.jobTitle);
        const dateHeader = `${sanitizeCvEnglishText(experience.startDate || "") || "MM/YYYY"} - ${
          sanitizeCvEnglishText(experience.endDate || "") || "Present"
        }`;
        const headerLine = titleLine ? `${titleLine} (${dateHeader})` : dateHeader;
        mainY = writeBulletBlock(headerLine, mainX + 16, mainY, mainWidth - 32);
        const bulletPoints = Array.isArray(experience.bulletPoints) ? experience.bulletPoints : [];
        bulletPoints.forEach((bullet) => {
          mainY = writeBulletBlock(sanitizeCvEnglishText(bullet), mainX + 28, mainY, mainWidth - 44);
        });
      });
    } else {
      mainY = writeBulletBlock("No verified experience records yet.", mainX + 16, mainY, mainWidth - 32);
    }
    mainY += 8;

    mainY = drawSectionHeading("Education", mainX + 16, mainY, mainWidth - 32);
    const educationItems = String(cvReviewForm.educationHistory || "")
      .split("\n")
      .map((entry) => parseEducationEntry(entry))
      .filter((entry) => entry.title || entry.startDate || entry.endDate);
    if (educationItems.length) {
      educationItems.forEach((item) => {
        mainY = writeBulletBlock(
          toProfessionalTitleCase(item.title),
          mainX + 16,
          mainY,
          mainWidth - 32
        );
        mainY = writeBulletBlock(
          `${sanitizeCvEnglishText(item.startDate || "") || "MM/YYYY"} - ${
            sanitizeCvEnglishText(item.endDate || "") || "End Date"
          }`,
          mainX + 28,
          mainY,
          mainWidth - 44
        );
      });
    } else {
      mainY = writeBulletBlock("No education details provided.", mainX + 16, mainY, mainWidth - 32);
    }

    const safeName = String(cvReviewForm.fullName || "candidate").trim().replace(/[^\w\s-]/g, "");
    doc.save(`${safeName || "candidate"}-cv.pdf`);
  };

  const handleConfirmAndDownloadCv = async () => {
    const requiredMissing =
      !String(cvReviewForm.fullName || "").trim() ||
      !String(cvReviewForm.phoneNumber || "").trim() ||
      !String(cvReviewForm.professionalSummary || "").trim();

    if (requiredMissing) {
      setCvReviewWarning(CV_WARNING_TEXT);
      setShowCvPreviewModal(false);
      setShowCvReviewModal(true);
      toastError(CV_WARNING_TEXT);
      return;
    }

    try {
      setIsGeneratingCv(true);
      setCvReviewWarning("");
      await syncCandidateProfileForCv();
      await generateCandidateCvPdf();
      setShowCvReviewModal(false);
      setShowCvPreviewModal(false);
      toastSuccess("CV downloaded successfully.");
    } catch (error) {
      toastError(error.message || "Failed to generate CV");
    } finally {
      setIsGeneratingCv(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const toggleOnboardingSkill = (skill) => {
    setOnboardingError("");
    setOnboardingShake(false);
    setShowProfileSkillAiTip(true);
    setOnboardingSkills((prev) => {
      const exists = prev.includes(skill);
      if (exists) {
        return prev.filter((entry) => entry !== skill);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, skill];
    });
  };

  const suggestedAdvancedSkillKeys = useMemo(() => {
    const pool = onboardingSkills.flatMap(
      (category) => SKILL_SUGGESTIONS_BY_CATEGORY[category] || []
    );
    return Array.from(new Set(pool.map((entry) => toSkillKey(entry)).filter(Boolean))).slice(0, 12);
  }, [onboardingSkills]);

  useEffect(() => {
    if (!suggestedAdvancedSkillKeys.length) {
      setOnboardingAdvancedSkills([]);
      return;
    }
    setOnboardingAdvancedSkills((prev) => {
      const kept = prev.filter((entry) => suggestedAdvancedSkillKeys.includes(toSkillKey(entry)));
      if (kept.length > 0) {
        return kept;
      }
      return suggestedAdvancedSkillKeys.slice(0, Math.min(5, suggestedAdvancedSkillKeys.length));
    });
  }, [suggestedAdvancedSkillKeys]);

  const toggleAdvancedSkill = (skillKey) => {
    setShowProfileSkillAiTip(true);
    setOnboardingAdvancedSkills((prev) => {
      const exists = prev.includes(skillKey);
      if (exists) {
        return prev.filter((entry) => entry !== skillKey);
      }
      return [...prev, skillKey];
    });
  };

  const addProfileCategory = (value = profileCategoryInput) => {
    const nextCategory = toProfessionalTitleCase(value);
    if (!nextCategory) {
      return;
    }
    setOnboardingSkills([nextCategory]);
    setProfileCategoryInput(nextCategory);
    setShowProfileSkillAiTip(true);
  };

  const clearProfileCategory = () => {
    setOnboardingSkills([]);
    setProfileCategoryInput("");
    setShowProfileSkillAiTip(true);
  };

  const addProfileSkill = (value = profileSkillInput) => {
    const nextSkill = toProfessionalSkillLabel(value);
    if (!nextSkill) {
      return;
    }
    const nextKey = toSkillKey(nextSkill);
    const alreadySuggested = filteredProfileSkillSuggestions.some(
      (entry) => toSkillKey(entry.label || entry.key) === nextKey
    );
    setOnboardingAdvancedSkills((prev) => {
      if (prev.some((entry) => toSkillKey(entry) === nextKey)) {
        return prev;
      }
      return [...prev, nextKey];
    });
    if (!alreadySuggested) {
      setNewlyCreatedProfileSkillKeys((prev) => Array.from(new Set([...prev, nextKey])));
      window.setTimeout(() => {
        setNewlyCreatedProfileSkillKeys((prev) => prev.filter((entry) => entry !== nextKey));
      }, 2400);
    }
    setProfileSkillInput("");
    setShowProfileSkillAiTip(true);
  };

  const handleOnboardingSubmit = async (event) => {
    event.preventDefault();
    const role = String(user?.role || user?.accountType || "").toLowerCase();
    if (role !== "candidate") {
      setShowOnboardingModal(false);
      return;
    }
    const selectedCount = onboardingSkills.length;
    if (selectedCount < 1) {
      setOnboardingShake(true);
      window.setTimeout(() => setOnboardingShake(false), 360);
      setOnboardingError(
        t("onboarding.categoryValidation", {
          defaultValue: "Please select at least 1 job category.",
        })
      );
      return;
    }
    if (selectedCount > 2) {
      setOnboardingError(
        t("onboarding.categoryValidationMax", {
          defaultValue: "Please select up to 2 job categories.",
        })
      );
      return;
    }
    if (!String(onboardingLocation || "").trim()) {
      setOnboardingError(
        t("onboarding.locationValidation", {
          defaultValue: "Please select your preferred location.",
        })
      );
      return;
    }

    try {
      setIsSubmittingOnboarding(true);
      setOnboardingError("");
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferredCategories: onboardingSkills.slice(0, 2).map((entry) => toSkillKey(entry)),
          preferredCategory: toSkillKey(onboardingSkills[0] || ""),
          skills: onboardingAdvancedSkills.map((entry) => toSkillKey(entry)).filter(Boolean),
          preferredLocation: onboardingLocation,
          isFirstLogin: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.message ||
            t("onboarding.saveFailed", { defaultValue: "Failed to save onboarding data." })
        );
      }
      await refreshCurrentUser();
      setShowOnboardingModal(false);
      toastSuccess(
        t("onboarding.saved", { defaultValue: "Profile preferences saved successfully." })
      );
    } catch (error) {
      setOnboardingError(
        error.message ||
          t("onboarding.saveFailed", { defaultValue: "Failed to save onboarding data." })
      );
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  const cvPreviewData = useMemo(() => {
    const previewSkills = (Array.isArray(cvReviewForm.skills) ? cvReviewForm.skills : [])
      .map((skill, index) => normalizeCvSkillEntry(skill, index))
      .filter(Boolean)
      .map((skill) => ({
        ...skill,
        label: sanitizeCvEnglishText(skill.label),
      }));
    const previewLanguages = cvReviewForm.languages
      .map((language) => sanitizeCvEnglishText(language))
      .filter(Boolean);
    const previewExperiences = cvReviewForm.workExperiences.map((experience) => ({
      title: toProfessionalTitleCase(experience.jobTitle) || "Experience",
      dateRange: `${sanitizeCvEnglishText(experience.startDate || "") || "MM/YYYY"} - ${
        sanitizeCvEnglishText(experience.endDate || "") || "Present"
      }`,
      bullets: (Array.isArray(experience.bulletPoints) ? experience.bulletPoints : [])
        .map((bullet) => sanitizeCvEnglishText(bullet))
        .filter(Boolean),
    }));
    const previewEducation = String(cvReviewForm.educationHistory || "")
      .split("\n")
      .map((entry) => parseEducationEntry(entry))
      .filter((entry) => entry.title || entry.startDate || entry.endDate)
      .map((entry) => ({
        title: toProfessionalTitleCase(entry.title),
        dateRange: `${sanitizeCvEnglishText(entry.startDate || "") || "MM/YYYY"} - ${
          sanitizeCvEnglishText(entry.endDate || "") || "End Date"
        }`,
      }));
    const fullName = sanitizeCvEnglishText(cvReviewForm.fullName) || "Candidate";
    const summary = sanitizeCvEnglishText(cvReviewForm.professionalSummary);

    return {
      fullName,
      summary,
      skills: previewSkills,
      languages: previewLanguages,
      experiences: previewExperiences,
      education: previewEducation,
      contact: {
        phone: sanitizeCvEnglishText(cvReviewForm.phoneNumber) || "-",
        email: sanitizeCvEnglishText(user?.email) || "-",
        telegram: sanitizeCvEnglishText(user?.telegramUsername)
          ? `@${sanitizeCvEnglishText(user?.telegramUsername).replace(/^@/, "")}`
          : "-",
      },
    };
  }, [cvReviewForm, user?.email, user?.telegramUsername]);

  return (
    <section className="space-y-4">
      {showOnboardingModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <form
            onSubmit={handleOnboardingSubmit}
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"
            style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
          >
            <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full w-[88%] rounded-full bg-indigo-600" />
            </div>

            <h2 className="text-lg font-bold text-indigo-600">
              {t("onboarding.title", { defaultValue: "Complete Your Profile" })}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("onboarding.subtitle", {
                defaultValue: "Select your preferred job categories and working zone.",
              })}
            </p>

            <motion.div
              className="mt-4"
              animate={onboardingShake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.28 }}
            >
              <p className="text-sm font-bold text-indigo-600">
                {t("onboarding.categoriesLabel", { defaultValue: "Job Categories (1 to 2)" })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ONBOARDING_SKILLS.map((skill) => {
                  const active = onboardingSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleOnboardingSkill(skill)}
                      className={`rounded-2xl px-3 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "border-none bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t(`categories.${toSkillKey(skill)}`, { defaultValue: skill })}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t("onboarding.selectedCount", {
                  defaultValue: "{{count}} selected",
                  count: onboardingSkills.length,
                })}
              </p>
            </motion.div>

            <div
              className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <p className="text-sm font-bold text-indigo-600">
                {t("onboarding.selectedCategoriesTitle", {
                  defaultValue: "Your Selected Categories",
                })}
              </p>
              {onboardingSkills.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {onboardingSkills.map((skill) => (
                    <span
                      key={`selected-${skill}`}
                      className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700"
                    >
                      {t(`categories.${toSkillKey(skill)}`, { defaultValue: skill })}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {t("onboarding.noCategorySelected", {
                    defaultValue: "No categories selected yet.",
                  })}
                </p>
              )}
            </div>

            <div
              className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <p className="text-sm font-bold text-indigo-600">
                {t("onboarding.advancedSkills", { defaultValue: "Advanced Skills (Optional)" })}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t("onboarding.advancedSkillsHint", {
                  defaultValue: "Recommended based on your selected categories.",
                })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestedAdvancedSkillKeys.map((skillKey) => {
                  const active = onboardingAdvancedSkills.includes(skillKey);
                  return (
                    <button
                      key={`adv-${skillKey}`}
                      type="button"
                      onClick={() => toggleAdvancedSkill(skillKey)}
                      className={`rounded-2xl px-2.5 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "border-none bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t(`skills.${skillKey}`, { defaultValue: skillKey })}
                    </button>
                  );
                })}
                {!suggestedAdvancedSkillKeys.length ? (
                  <span className="text-xs text-slate-500">
                    {t("onboarding.noAdvancedSkills", {
                      defaultValue: "Choose categories to see skill suggestions.",
                    })}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-bold text-indigo-600">
                {t("onboarding.locationLabel", { defaultValue: "Preferred Phnom Penh Zone" })}
              </label>
              <select
                value={onboardingLocation}
                onChange={(event) => {
                  setOnboardingLocation(event.target.value);
                  setOnboardingError("");
                }}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">
                  {t("onboarding.selectLocation", { defaultValue: "Select location" })}
                </option>
                {PHNOM_PENH_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>

            {onboardingError ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {onboardingError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-stretch sm:justify-end">
              <button
                type="submit"
                disabled={isSubmittingOnboarding}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
              >
                {isSubmittingOnboarding
                  ? t("common.saving", { defaultValue: "Saving..." })
                  : t("onboarding.saveContinue", { defaultValue: "Save & Continue" })}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isEmployer && showCvReviewModal ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-3 py-3 sm:items-center sm:px-4 sm:py-6">
          <div
            className="flex w-full max-w-2xl flex-col rounded-2xl bg-white p-4 shadow-2xl sm:p-5 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]"
            style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-indigo-600">ផ្ទៀងផ្ទាត់ព័ត៌មានសម្រាប់ CV</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Review and confirm your profile details before download.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseCvReviewModal}
                disabled={isGeneratingCv}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {aiSlowMessage ? (
                <p
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 shadow-[0_0_16px_rgba(79,70,229,0.2)]"
                  style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                >
                  {aiSlowMessage}
                </p>
              ) : null}

              <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3 py-2 shadow-[0_0_18px_rgba(79,70,229,0.18)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    CV Health Score
                  </span>
                  <span className="text-sm font-bold text-indigo-700">
                    {isAiHealthLoading ? "..." : `${Math.round(Number(aiHealth.score || 0))}/100`}
                  </span>
                </div>
                {String(aiHealth.tip || "").trim() ? (
                  <p className="mt-1 text-xs text-indigo-700">{aiHealth.tip}</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
                    >
                      <LazyAvatar
                        src={profilePictureUrl}
                        alt={cvReviewForm.fullName || "Profile"}
                        name={String(cvReviewForm.fullName || user?.name || "U")}
                        className="h-full w-full"
                        textClassName="text-2xl"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow">
                        <Camera size={14} />
                      </span>
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Profile Photo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        Add or update the photo shown on your CV.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Use a clear headshot for a more professional CV preview.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      <Camera size={14} />
                      <span>{selectedPictureFile ? "Change Photo" : "Upload Photo"}</span>
                    </button>
                    {selectedPictureFile ? (
                      <button
                        type="button"
                        onClick={handlePictureUpload}
                        disabled={isUploadingPicture}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save size={14} />
                        <span>{isUploadingPicture ? "Uploading..." : "Save Photo"}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Full Name
                </span>
                <input
                  type="text"
                  value={cvReviewForm.fullName}
                  onChange={(event) => handleCvReviewChange("fullName", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Number *
                </span>
                <input
                  type="text"
                  value={cvReviewForm.phoneNumber}
                  onChange={(event) => handleCvReviewChange("phoneNumber", event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Professional Summary *</span>
                  <button
                    type="button"
                    onClick={handleGenerateAiSummary}
                    disabled={isGeneratingAiSummary || isRefiningSummary}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 shadow-[0_0_14px_rgba(79,70,229,0.22)] transition hover:bg-indigo-100 disabled:opacity-60"
                    style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                  >
                    <WandSparkles size={12} />
                    <span>{isGeneratingAiSummary ? "Generating..." : "AI Magic"}</span>
                  </button>
                </span>
                <textarea
                  rows={4}
                  maxLength={200}
                  value={cvReviewForm.professionalSummary}
                  onChange={(event) =>
                    handleCvReviewChange("professionalSummary", event.target.value.slice(0, 200))
                  }
                  onBlur={handleRefineSummary}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {cvReviewForm.professionalSummary.length}/200
                </p>
              </label>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Work Experience
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 shadow-[0_0_14px_rgba(79,70,229,0.22)]">
                    <Sparkles size={11} />
                    AI Smart Helper
                  </span>
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={cvExperienceTitleInput}
                    onChange={(event) => setCvExperienceTitleInput(event.target.value)}
                    placeholder="Enter job title"
                    className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    style={CV_INPUT_FONT_STYLE}
                  />
                  <button
                    type="button"
                    onClick={handleAddWorkExperience}
                    disabled={!String(cvExperienceTitleInput || "").trim() || isGeneratingAiExperience}
                    className="inline-flex h-10 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 shadow-[0_0_14px_rgba(79,70,229,0.22)] transition hover:bg-indigo-100 disabled:opacity-60"
                  >
                    <Sparkles size={13} />
                    <span>{isGeneratingAiExperience ? "Thinking..." : "Add + AI"}</span>
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={cvExperienceStartDateInput}
                    onChange={(event) =>
                      setCvExperienceStartDateInput(normalizeMonthYearInput(event.target.value))
                    }
                    placeholder="Start Date (MM/YYYY)"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    style={CV_INPUT_FONT_STYLE}
                  />
                  <input
                    type="text"
                    value={cvExperienceEndDateInput}
                    onChange={(event) =>
                      setCvExperienceEndDateInput(normalizeMonthYearInput(event.target.value))
                    }
                    placeholder="End Date (MM/YYYY)"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    style={CV_INPUT_FONT_STYLE}
                  />
                </div>

                <div className="mt-3 space-y-3">
                  {cvReviewForm.workExperiences.map((experience, index) => (
                    <div key={`work-exp-${index}`} className="rounded-xl border border-slate-200 p-3">
                      {(() => {
                        const aiScore = getExperienceAiScore(experience);
                        return (
                          <div className="mb-2 flex items-center justify-end">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                aiScore.isHighQuality
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              AI Score {aiScore.score}/100
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={experience.jobTitle}
                          onChange={(event) =>
                            handleWorkExperienceChange(index, "jobTitle", event.target.value)
                          }
                          placeholder="Job title"
                          className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          style={CV_INPUT_FONT_STYLE}
                        />
                        <button
                          type="button"
                          onClick={() => handleRegenerateExperienceSuggestions(index)}
                          disabled={isGeneratingAiExperience}
                          className="inline-flex h-10 items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-700 shadow-[0_0_14px_rgba(79,70,229,0.2)] transition hover:bg-indigo-100 disabled:opacity-60"
                        >
                          <Sparkles size={12} />
                          <span>Suggest</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkExperience(index)}
                          className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={experience.startDate || ""}
                          onChange={(event) =>
                            handleWorkExperienceChange(index, "startDate", event.target.value)
                          }
                          placeholder="Start Date (MM/YYYY)"
                          className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          style={CV_INPUT_FONT_STYLE}
                        />
                        <input
                          type="text"
                          value={experience.endDate || ""}
                          onChange={(event) =>
                            handleWorkExperienceChange(index, "endDate", event.target.value)
                          }
                          placeholder="End Date (MM/YYYY)"
                          className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          style={CV_INPUT_FONT_STYLE}
                        />
                      </div>
                      <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </label>
                      <div className="relative mt-1">
                        <textarea
                          rows={4}
                          value={(experience.bulletPoints || []).join("\n")}
                          onChange={(event) =>
                            handleWorkExperienceChange(index, "bulletText", event.target.value)
                          }
                          onBlur={() => handleRefineExperienceBullets(index)}
                          placeholder="One bullet point per line"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          style={CV_INPUT_FONT_STYLE}
                        />
                        {aiExperienceLoadingIndex === index ? (
                          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/90 via-indigo-200/50 to-indigo-50/90 animate-pulse" />
                        ) : null}
                      </div>
                      {Array.isArray(experience.aiKeywords) && experience.aiKeywords.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {experience.aiKeywords.map((keyword) => (
                            <button
                              key={`exp-keyword-${index}-${keyword}`}
                              type="button"
                              onClick={() => handleApplyExperienceKeyword(index, keyword)}
                              className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                            >
                              {keyword}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!cvReviewForm.workExperiences.length ? (
                    <p className="text-xs text-slate-500">No work experience entries added yet.</p>
                  ) : null}
                </div>
              </div>

              <div className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Education History
                </span>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
                    <input
                      type="text"
                      value={cvEducationTitleInput}
                      onChange={(event) => setCvEducationTitleInput(event.target.value)}
                      placeholder="School or degree"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      style={CV_INPUT_FONT_STYLE}
                    />
                    <input
                      type="text"
                      value={cvEducationStartDateInput}
                      onChange={(event) =>
                        setCvEducationStartDateInput(normalizeMonthYearInput(event.target.value))
                      }
                      placeholder="Start Date"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      style={CV_INPUT_FONT_STYLE}
                    />
                    <input
                      type="text"
                      value={cvEducationEndDateInput}
                      onChange={(event) =>
                        setCvEducationEndDateInput(normalizeMonthYearInput(event.target.value))
                      }
                      placeholder="End Date"
                      className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      style={CV_INPUT_FONT_STYLE}
                    />
                    <button
                      type="button"
                      onClick={addCvEducationEntry}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {String(cvReviewForm.educationHistory || "")
                      .split("\n")
                      .map((entry) => parseEducationEntry(entry))
                      .filter((entry) => entry.title || entry.startDate || entry.endDate)
                      .map((entry, index) => (
                        <div
                          key={`education-entry-${index}`}
                          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_140px_140px_auto]"
                        >
                          <input
                            type="text"
                            value={entry.title}
                            onChange={(event) =>
                              handleEducationHistoryEntryChange(index, "title", event.target.value)
                            }
                            placeholder="School or degree"
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            style={CV_INPUT_FONT_STYLE}
                          />
                          <input
                            type="text"
                            value={entry.startDate}
                            onChange={(event) =>
                              handleEducationHistoryEntryChange(index, "startDate", event.target.value)
                            }
                            placeholder="Start Date"
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            style={CV_INPUT_FONT_STYLE}
                          />
                          <input
                            type="text"
                            value={entry.endDate}
                            onChange={(event) =>
                              handleEducationHistoryEntryChange(index, "endDate", event.target.value)
                            }
                            placeholder="End Date"
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            style={CV_INPUT_FONT_STYLE}
                          />
                          <button
                            type="button"
                            onClick={() => removeEducationHistoryEntry(index)}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    {!String(cvReviewForm.educationHistory || "").trim() ? (
                      <p className="text-xs text-slate-500">No education entries added yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Skills
                </span>
                <div className="flex flex-wrap gap-2">
                  {cvReviewForm.skills.map((skill) => (
                    <span
                      key={`cv-skill-${skill}`}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeCvSkill(skill)}
                        className="rounded-full text-indigo-600 transition hover:text-indigo-800"
                        aria-label={`Remove ${skill}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {!cvReviewForm.skills.length ? (
                    <span className="text-xs text-slate-500">No skills selected yet.</span>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={cvSkillInput}
                    onChange={(event) => setCvSkillInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCvSkill();
                      }
                    }}
                    placeholder="Add skill"
                    className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={addCvSkill}
                    className="inline-flex h-10 items-center rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Languages
                </span>
                <div className="flex flex-wrap gap-2">
                  {cvReviewForm.languages.map((language) => (
                    <span
                      key={`cv-language-${language}`}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      <span>{language}</span>
                      <button
                        type="button"
                        onClick={() => removeCvLanguage(language)}
                        className="rounded-full text-slate-500 transition hover:text-slate-700"
                        aria-label={`Remove ${language}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {!cvReviewForm.languages.length ? (
                    <span className="text-xs text-slate-500">No languages added.</span>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={cvLanguageInput}
                    onChange={(event) => setCvLanguageInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCvLanguage();
                      }
                    }}
                    placeholder="Add language"
                    className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={addCvLanguage}
                    className="inline-flex h-10 items-center rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {cvReviewWarning ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  {cvReviewWarning}
                </p>
              ) : null}
            </div>

            <div className="mt-4 shrink-0 border-t border-slate-100 pt-3 flex flex-col-reverse gap-2 sm:mt-5 sm:flex-row sm:justify-end sm:pt-4">
              <button
                type="button"
                onClick={handleCloseCvReviewModal}
                disabled={isGeneratingCv}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAndUpdateCvProfile}
                disabled={isGeneratingCv}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaFileAlt size={15} />
                <span>{isGeneratingCv ? "Saving..." : "Save & Update Profile"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isEmployer && showCvPreviewModal ? (
        <div className="fixed inset-0 z-[95] flex flex-col bg-slate-900/70 backdrop-blur-[2px]">
          <div className="sticky top-0 z-20 mx-3 mt-3 flex items-center justify-between rounded-2xl border border-white/20 bg-white/95 px-4 py-3 shadow-sm sm:mx-6 sm:px-6">
            <div className="min-w-0">
              <h2
                className="truncate text-base font-bold text-indigo-700 sm:text-lg"
                style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
              >
                CV Preview
              </h2>
              <p className="text-xs text-slate-600 sm:text-sm">
                Verify layout and content before download.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseCvPreviewModal}
              disabled={isGeneratingCv}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>

          <div className="min-h-0 flex flex-1 items-start justify-center overflow-auto px-2 py-3 sm:px-5">
            <div
              className="relative mx-auto"
              style={{
                width: `${CV_PREVIEW_A4_WIDTH * cvPreviewScale}px`,
                height: `${CV_PREVIEW_A4_HEIGHT * cvPreviewScale}px`,
              }}
            >
              <div
                className="absolute left-0 top-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg"
                style={{
                  width: `${CV_PREVIEW_A4_WIDTH}px`,
                  height: `${CV_PREVIEW_A4_HEIGHT}px`,
                  transform: `scale(${cvPreviewScale})`,
                  transformOrigin: "top left",
                  fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
                }}
              >
                <div className="grid h-full grid-cols-[30%_70%]">
                    <aside className="h-full bg-[#F3F4F6] px-3 py-4 sm:px-5 sm:py-6">
                      <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-sm bg-slate-300 sm:h-28 sm:w-28">
                        {profilePictureUrl ? (
                          <img
                            src={profilePictureUrl}
                            alt={cvPreviewData.fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl font-bold text-slate-600">
                            {cvPreviewData.fullName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-indigo-600 sm:text-[32px] sm:leading-none">Contact</h3>
                      <div className="mt-1 border-t border-indigo-100 pt-2 text-xs text-slate-800 sm:text-sm">
                        <p>Phone: {cvPreviewData.contact.phone}</p>
                        <p className="break-all">Email: {cvPreviewData.contact.email}</p>
                        <p>Telegram: {cvPreviewData.contact.telegram}</p>
                      </div>

                      <h3 className="mt-4 text-lg font-bold text-indigo-600 sm:text-[32px] sm:leading-none">Skills</h3>
                      <div className="mt-1 border-t border-indigo-100 pt-2">
                        {(() => {
                          const groupedSkills = groupCvSkills(cvPreviewData.skills);
                          const skillChipClass =
                            "inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 sm:px-2.5 sm:py-1 sm:text-xs";
                          const skillFontStyle = {
                            fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
                          };
                          return groupedSkills.hard.length || groupedSkills.soft.length ? (
                            <div className="space-y-3">
                              {groupedSkills.hard.length ? (
                                <div>
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600 sm:text-xs">
                                    Hard Skills
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {groupedSkills.hard.map((skill) => (
                                      <span key={skill.id} className={skillChipClass} style={skillFontStyle}>
                                        <span>{skill.label}</span>
                                        {skill.isVerified ? (
                                          <CheckCircle size={11} className="text-blue-600" />
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {groupedSkills.soft.length ? (
                                <div>
                                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600 sm:text-xs">
                                    Soft Skills
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {groupedSkills.soft.map((skill) => (
                                      <span key={skill.id} className={skillChipClass} style={skillFontStyle}>
                                        <span>{skill.label}</span>
                                        {skill.isVerified ? (
                                          <CheckCircle size={11} className="text-blue-600" />
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No skills</span>
                          );
                        })()}
                      </div>

                      <h3 className="mt-4 text-lg font-bold text-indigo-600 sm:text-[32px] sm:leading-none">Languages</h3>
                      <div className="mt-1 border-t border-indigo-100 pt-2 text-xs text-slate-800 sm:text-sm">
                        <p>{cvPreviewData.languages.length ? cvPreviewData.languages.join(", ") : "-"}</p>
                      </div>
                    </aside>

                    <main className="h-full bg-white">
                      <div className="relative border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
                        <h1 className="text-xl font-semibold text-slate-900 sm:text-4xl">
                          {cvPreviewData.fullName}
                        </h1>
                        <p className="mt-1 text-sm text-slate-600 sm:text-[22px]">Professional Candidate</p>
                        {isVerified ? (
                          <span className="absolute right-3 top-3 inline-flex rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white sm:right-6 sm:top-5 sm:px-3 sm:text-xs">
                            WorkCloud Verified
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-3 px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
                        <section>
                          <h3 className="text-lg font-bold text-indigo-600 sm:text-[36px] sm:leading-none">Summary</h3>
                          <div className="mt-1 border-t border-indigo-100 pt-1.5 text-sm leading-relaxed text-slate-900 sm:text-[17px]">
                            {cvPreviewData.summary || "No summary provided."}
                          </div>
                        </section>

                        <section>
                          <h3 className="text-lg font-bold text-indigo-600 sm:text-[36px] sm:leading-none">Experience</h3>
                          <div className="mt-1 border-t border-indigo-100 pt-1.5 text-sm text-slate-900 sm:text-[17px]">
                            <ul className="list-disc space-y-2 pl-5">
                              {cvPreviewData.experiences.length ? (
                                cvPreviewData.experiences.map((experience, index) => (
                                  <li key={`preview-exp-${index}`} className="leading-relaxed">
                                    <span className="font-semibold">
                                      {experience.title} ({experience.dateRange})
                                    </span>
                                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                      {experience.bullets.length ? (
                                        experience.bullets.map((bullet, bulletIndex) => (
                                          <li key={`preview-exp-${index}-bullet-${bulletIndex}`}>
                                            {bullet}
                                          </li>
                                        ))
                                      ) : (
                                        <li>No achievements added yet.</li>
                                      )}
                                    </ul>
                                  </li>
                                ))
                              ) : (
                                <li>No verified experience records yet.</li>
                              )}
                            </ul>
                          </div>
                        </section>

                        <section>
                          <h3 className="text-lg font-bold text-indigo-600 sm:text-[36px] sm:leading-none">Education</h3>
                          <div className="mt-1 border-t border-indigo-100 pt-1.5 text-sm text-slate-900 sm:text-[17px]">
                            <ul className="list-disc space-y-1 pl-5">
                              {cvPreviewData.education.length ? (
                                cvPreviewData.education.map((item, index) => (
                                  <li key={`preview-edu-${index}`}>
                                    {item.title}
                                    <ul className="list-disc pl-5">
                                      <li>{item.dateRange}</li>
                                    </ul>
                                  </li>
                                ))
                              ) : (
                                <li>No education details provided.</li>
                              )}
                            </ul>
                          </div>
                        </section>
                      </div>
                    </main>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-20 mx-3 mb-3 flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/95 px-4 py-3 shadow-sm sm:mx-6 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => {
                setShowCvPreviewModal(false);
                setShowCvReviewModal(true);
              }}
              disabled={isGeneratingCv}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-transparent px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={handleConfirmAndDownloadCv}
              disabled={isGeneratingCv}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Download size={15} />
              <span>{isGeneratingCv ? "Generating..." : "Download PDF"}</span>
            </button>
          </div>
        </div>
      ) : null}

      <header className="relative rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className={`min-w-0 ${isEmployer ? "w-full" : ""}`}>
            <div
              className={`mb-3 flex gap-3 ${
                isEmployer
                  ? "w-full flex-col"
                  : "items-start justify-between"
              }`}
            >
              {!isEmployer ? (
                <div>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleAvatarClick}
                        className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow"
                      >
                        <LazyAvatar
                          src={profilePictureUrl}
                          alt="Profile"
                          name={String(user?.name || "U")}
                          className="h-full w-full"
                          textClassName="text-2xl"
                        />
                        <span className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow">
                          <Camera size={13} />
                        </span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePictureSelect}
                        className="hidden"
                      />
                      {selectedPictureFile ? (
                        <button
                          type="button"
                          onClick={handlePictureUpload}
                          disabled={isUploadingPicture}
                          className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                        >
                          <Save size={12} />
                          <span>
                            {isUploadingPicture
                              ? t("profile.uploading", { defaultValue: "Uploading..." })
                              : t("profile.savePhoto", { defaultValue: "Save Photo" })}
                          </span>
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow">
                      <LazyAvatar
                        src={profilePictureUrl}
                        alt="Profile"
                        name={String(user?.name || "U")}
                        className="h-full w-full"
                        textClassName="text-2xl"
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {isEmployer ? (
  <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    {/* 1. Language Button - ដាក់ឱ្យនៅជ្រុងខាងលើបំផុតផ្នែកខាងស្តាំ */}
    <div className="absolute right-3 top-3 z-20 max-w-[calc(100%-1.5rem)] sm:right-4 sm:top-4">
      <LanguageSwitcher className="max-w-full" menuPlacement="down" />
    </div>

    {/* 2. Slim Cover Photo - បន្ថយកម្ពស់ និងពង្រីកពេញទទឹង */}
    <div className="h-24 w-full bg-slate-100 sm:h-28">
      {companyCoverDisplayUrl ? (
        <img src={companyCoverDisplayUrl} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-r from-indigo-600 to-blue-500" />
      )}
    </div>

    {/* 3. Identity Stack - អក្សរនៅខាងក្រោមរូបភាពជានិច្ច */}
    <div className="px-5 pb-5">
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        {/* Logo Overlap */}
        <div className="-mt-10 sm:-mt-12">
          <LazyAvatar
            src={companyLogoDisplayUrl}
            className="h-20 w-20 rounded-full border-4 border-white bg-white shadow-md sm:h-24 sm:w-24"
          />
        </div>

        {/* Text Section - ស្ថិតនៅលើផ្ទៃពណ៌សដើម្បីឱ្យច្បាស់ */}
                      <div className="min-w-0 flex-1 pt-2 sm:pt-0">
          <h1 className="break-words text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                          {form.companyName ||
                            user?.companyName ||
                            t("employer.companyProfile", { defaultValue: "Company Profile" })}
                        </h1>
                        {isVerified && (
                          <div className="mt-1 flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 uppercase w-fit">
                            <CheckCircle size={12} />
                            <span>{t("jobCard.verified", { defaultValue: "Verified" })}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {showCompanyPreview ? (
                      <div className="mt-4 space-y-3">
                        <div
                          className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
                          style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("profile.companyBio", { defaultValue: "Company Bio" })}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {form.companyDescription ||
                              t("profile.companyBioPlaceholder", {
                                defaultValue:
                                  "Describe your company and office culture to attract the best talent.",
                              })}
                          </p>
                        </div>

                        <div
                          className="grid gap-3 sm:grid-cols-2"
                          style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                        >
                          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="flex items-start gap-2">
                              <FaMapMarkerAlt className="mt-0.5 text-indigo-600" size={15} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-500">
                                  {t("profile.companyLocation", { defaultValue: "Company Location" })}
                                </p>
                                <p className="break-all text-sm leading-snug text-slate-800">
                                  {form.companyAddress ||
                                    t("common.notAvailable", { defaultValue: "Not available" })}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="flex items-start gap-2">
                              <Users className="mt-0.5 text-indigo-600" size={15} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-500">
                                  {t("profile.companySize", { defaultValue: "Company Size" })}
                                </p>
                                <p className="break-all text-sm leading-snug text-slate-800">
                                  {form.companySize ||
                                    t("common.notProvided", { defaultValue: "Not Provided" })}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                            <div className="flex items-start gap-2">
                              <FaPhoneAlt className="mt-0.5 text-indigo-600" size={14} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-500">
                                  {t("profile.businessPhone", { defaultValue: "Business Phone" })}
                                </p>
                                <p className="break-all text-sm leading-snug text-slate-800">
                                  {form.businessPhoneNumber ||
                                    t("common.notAvailable", { defaultValue: "Not available" })}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                            <div className="flex items-start gap-2">
                              <FaTelegramPlane className="mt-0.5 text-indigo-600" size={15} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-500">
                                  {t("profile.businessTelegram", { defaultValue: "Business Telegram" })}
                                </p>
                                <p className="break-all text-sm leading-snug text-slate-800">
                                  {form.businessTelegramUsername ||
                                    t("common.notAvailable", { defaultValue: "Not available" })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!isEmployer ? (
                <LanguageSwitcher
                  className="max-w-full shrink-0 self-start"
                  menuPlacement="down"
                />
              ) : null}
            </div>

            {!isEmployer ? (
              <>
                <div className="mt-1">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {user?.name || t("profile.title")}
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                    {String(form.bio || "").trim() ||
                      t("profile.addBio", { defaultValue: "Add Bio" })}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FaGraduationCap className="shrink-0 text-slate-400" size={15} />
                    <span className="break-words">
                      {String(form.university || form.school || "").trim()
                        ? t("profile.studentAt", {
                            defaultValue: "Student at {{name}}",
                            name: String(form.university || form.school || "").trim(),
                          })
                        : t("profile.education", { defaultValue: "Education" })}
                    </span>
                  </span>
                  <span className="hidden h-4 border-l border-slate-200 sm:block" aria-hidden="true" />
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle className="shrink-0 text-slate-400" size={15} />
                    <span>
                      <span className="font-semibold text-slate-700">{verifiedApplicationsCount}</span>{" "}
                      {t("profile.verifiedApplications", { defaultValue: "Verified Applications" })}
                    </span>
                  </span>
                </div>
                {isVerified ? (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle size={14} />
                    <span>{t("profile.verifiedContact", { defaultValue: "Verified Contact" })}</span>
                  </span>
                ) : null}
                <div className="mt-5 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <section className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-800">
                        {t("profile.selectedSkills", { defaultValue: "Selected Skills" })}
                      </h2>
                      <span className="text-xs text-slate-400">
                        {candidateSkills.length}
                      </span>
                    </div>
                    {candidateSkills.length ? (
                      <div
                        className="mt-2.5 flex flex-wrap gap-2"
                        style={
                          activeLanguageCode === "km"
                            ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                            : undefined
                        }
                      >
                        {candidateSkills.map((skill) => {
                          const softSkill = isSoftSkill(skill);
                          return (
                            <span
                              key={`profile-skill-${skill}`}
                              className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${softSkill ? "border-emerald-200/80 bg-emerald-50/70" : "border-slate-200 bg-white"}`}
                            >
                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${softSkill ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600"}`}
                                aria-hidden="true"
                              >
                                {softSkill ? <Sparkles size={12} /> : <Code2 size={12} />}
                              </span>
                              <span>{skill}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2.5 text-sm text-slate-500">-</p>
                    )}
                  </section>
                  <section className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-800">
                        {t("profile.selectedCategories", { defaultValue: "Selected Categories" })}
                      </h2>
                      <span className="text-xs text-slate-400">
                        {candidateCategories.length}
                      </span>
                    </div>
                    {candidateCategories.length ? (
                      <div
                        className="mt-2.5 flex flex-wrap gap-2"
                        style={
                          activeLanguageCode === "km"
                            ? { fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }
                            : undefined
                        }
                      >
                        {candidateCategories.map((categoryKey) => (
                          <span
                            key={`profile-category-${categoryKey}`}
                            className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                          >
                            {t(`categories.${toSkillKey(categoryKey)}`, {
                              defaultValue:
                                CATEGORY_KEY_TO_LABEL[toSkillKey(categoryKey)] || categoryKey,
                            })}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2.5 text-sm text-slate-500">-</p>
                    )}
                  </section>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-lg">
        <h2 className="text-sm font-semibold text-slate-900">
          {isEmployer
            ? t("profile.employerReputation", { defaultValue: "Employer Reputation" })
            : t("profile.trustGauge")}
        </h2>
          <div className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={trustMeta.color}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{trustScore}</span>
                <span className="wc-nav-label text-xs font-semibold text-slate-500">
                  {t(`profile.levels.${trustMeta.level.toLowerCase()}`)}
                </span>
              </div>
            </div>
            <div className="w-full text-sm text-slate-600 sm:w-auto">
              {!isEmployer ? (
                <p className="mb-1">
                  <span className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 sm:justify-start">
                    {t("profile.verifiedApplications", { defaultValue: "Verified Applications" })}: {" "}
                    {verifiedApplicationsCount}
                  </span>
                </p>
              ) : null}
              <p>
                {t("profile.role")}:{" "}
                <span className="font-semibold capitalize text-slate-900">{user?.role || "-"}</span>
              </p>
              <p className="mt-1">
                {t("profile.trustHintProfessional", {
                  defaultValue:
                    "Trust updates based on your professional application behavior and employer response.",
                })}
              </p>
            </div>
          </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {isEmployer
                ? t("profile.companySettings", { defaultValue: "Company Settings" })
                : t("profile.editProfile", { defaultValue: "Edit Profile" })}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isEmployer
                ? t("profile.companySettingsHint", {
                    defaultValue: "Manage one company identity and define business inquiry channels.",
                  })
                : t("profile.editProfileHint", {
                    defaultValue: "Update your personal profile and quick chat contact.",
                  })}
            </p>
          </div>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setProfileError("");
                setProfileSuccess("");
                setIsEditing(true);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <Pencil size={16} />
              <span>{t("profile.editProfile", { defaultValue: "Edit Profile" })}</span>
            </button>
          ) : null}
        </div>

        {profileError ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {profileError}
          </p>
        ) : null}

        {profileSuccess ? (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {profileSuccess}
          </p>
        ) : null}

        {!isEditing ? (
          <div
            className="mx-auto mt-5 grid w-full max-w-3xl gap-4 px-1 text-sm text-slate-700 sm:grid-cols-2 sm:px-2"
            style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
          >
            {!isEmployer ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Phone</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.phoneNumber || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Telegram</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.telegramUsername || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Education</p>
                  <p className="mt-2 break-words text-base text-slate-900">
                    {String(form.university || form.school || "").trim() || "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preferred Contact</p>
                  <p className="mt-2 break-words text-base capitalize text-slate-900">
                    {form.preferredContactMethod || "none"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bio</p>
                  <p className="mt-2 whitespace-pre-wrap text-base text-slate-900">{form.bio || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Job Categories</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {candidateCategories.length ? (
                      candidateCategories.map((categoryKey) => (
                        <span
                          key={`readonly-category-${categoryKey}`}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        >
                          {t(`categories.${toSkillKey(categoryKey)}`, {
                            defaultValue:
                              CATEGORY_KEY_TO_LABEL[toSkillKey(categoryKey)] || categoryKey,
                          })}
                        </span>
                      ))
                    ) : (
                      <span className="text-base text-slate-900">-</span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t("profile.selectedSkills", { defaultValue: "Selected Skills" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {candidateSkills.length ? (
                      candidateSkills.map((skill) => (
                        <span
                          key={`readonly-skill-${skill}`}
                          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-base text-slate-900">-</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Company Name</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.companyName || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Website</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.companyWebsite || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Business Phone</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.businessPhoneNumber || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Business Telegram</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.businessTelegramUsername || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Company Size</p>
                  <p className="mt-2 break-words text-base text-slate-900">{form.companySize || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preferred Contact</p>
                  <p className="mt-2 break-words text-base capitalize text-slate-900">
                    {form.preferredContactMethod || "none"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Company Address</p>
                  <p className="mt-2 whitespace-pre-wrap text-base text-slate-900">{form.companyAddress || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Company Bio</p>
                  <p className="mt-2 whitespace-pre-wrap text-base text-slate-900">{form.companyDescription || "-"}</p>
                </div>
              </>
            )}
            {!isEmployer ? (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => handleOpenCvPreviewModal(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  <Download size={16} />
                  <span>Export to CV</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
        <form onSubmit={handleProfileSubmit} className="mx-auto mt-5 w-full max-w-3xl space-y-5 px-1 sm:px-2">
          {!isEmployer ? (
            <>
              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Phone size={14} />
                  <span>{t("profile.phoneNumber", { defaultValue: "Phone Number" })}</span>
                </span>
                <input
                  type="text"
                  value={form.phoneNumber}
                  onChange={(event) => handleProfileChange("phoneNumber", event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Send size={14} />
                  <span>{t("profile.telegramUsername", { defaultValue: "Telegram Username" })}</span>
                </span>
                <input
                  type="text"
                  value={form.telegramUsername}
                  onChange={(event) => handleProfileChange("telegramUsername", event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Users size={14} />
                  <span>{t("profile.education", { defaultValue: "Education" })}</span>
                </span>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={form.university}
                      onFocus={() => setEducationFocusField("university")}
                      onBlur={() => {
                        window.setTimeout(() => setEducationFocusField(""), 120);
                      }}
                      onChange={(event) => {
                        handleProfileChange("university", event.target.value);
                        setEducationFocusField("university");
                      }}
                      placeholder={t("profile.searchUniversity", {
                        defaultValue: "Search University",
                      })}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                    {educationFocusField === "university" && educationSuggestions.length ? (
                      <ul
                        className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                        style={
                          activeLanguageCode === "km"
                            ? { fontFamily: "\"Kantumruy Pro\", sans-serif" }
                            : undefined
                        }
                      >
                        {educationSuggestions.map((item) => (
                          <li key={`uni-${item}`}>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleEducationPick("university", item)}
                              className="w-full whitespace-nowrap px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                            >
                              {item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={form.school}
                      onFocus={() => setEducationFocusField("school")}
                      onBlur={() => {
                        window.setTimeout(() => setEducationFocusField(""), 120);
                      }}
                      onChange={(event) => {
                        handleProfileChange("school", event.target.value);
                        setEducationFocusField("school");
                      }}
                      placeholder={t("profile.searchSchool", {
                        defaultValue: "Search School",
                      })}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                    {educationFocusField === "school" && educationSuggestions.length ? (
                      <ul
                        className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                        style={
                          activeLanguageCode === "km"
                            ? { fontFamily: "\"Kantumruy Pro\", sans-serif" }
                            : undefined
                        }
                      >
                        {educationSuggestions.map((item) => (
                          <li key={`sch-${item}`}>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleEducationPick("school", item)}
                              className="w-full whitespace-nowrap px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                            >
                              {item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Users size={14} />
                  <span>
                    {t("profile.preferredContactMethod", {
                      defaultValue: "Preferred Contact Method",
                    })}
                  </span>
                </span>
                <select
                  value={form.preferredContactMethod}
                  onChange={(event) =>
                    handleProfileChange("preferredContactMethod", event.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="none">{t("profile.contactNone", { defaultValue: "None" })}</option>
                  <option value="phone">{t("profile.contactPhone", { defaultValue: "Phone" })}</option>
                  <option value="telegram">{t("profile.contactTelegram", { defaultValue: "Telegram" })}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Users size={14} />
                  <span>{t("profile.bioStrengths", { defaultValue: "Bio (Personal Strengths)" })}</span>
                </span>
                <textarea
                  rows={5}
                  maxLength={200}
                  value={form.bio}
                  onChange={(event) => handleProfileChange("bio", event.target.value)}
                  placeholder={t("profile.bioPlaceholder", { defaultValue: "Tell employers about your strengths" })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-xs font-medium text-slate-400">{form.bio.length}/200</p>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <WandSparkles size={16} className="text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Job Category & Skills</h3>
                </div>

                <div className="mt-5">
                  <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <Users size={14} />
                    <span>Job Category</span>
                  </span>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={profileCategoryInput}
                      onChange={(event) => setProfileCategoryInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addProfileCategory();
                        }
                      }}
                      placeholder="Search or create category"
                      className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <button
                      type="button"
                      onClick={() => addProfileCategory()}
                      className="inline-flex h-12 items-center rounded-xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      {filteredProfileCategorySuggestions.some(
                        (entry) => toSkillKey(entry.label) === toSkillKey(profileCategoryInput)
                      )
                        ? "Add"
                        : `Create`}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filteredProfileCategorySuggestions.map((category) => (
                      <button
                        key={`profile-category-suggestion-${category.key}`}
                        type="button"
                        onClick={() => addProfileCategory(category.label)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        {category.label}
                      </button>
                    ))}
                    {isCatalogLoading && !filteredProfileCategorySuggestions.length ? (
                      <span className="text-xs text-slate-500">Loading categories...</span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {onboardingSkills.length ? (
                      onboardingSkills.map((category) => (
                        <span
                          key={`profile-selected-category-${category}`}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        >
                          <span>{category}</span>
                          <button
                            type="button"
                            onClick={clearProfileCategory}
                            className="rounded-full text-emerald-600 transition hover:text-emerald-800"
                            aria-label={`Remove ${category}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No category selected yet.</span>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <Sparkles size={14} />
                    <span>Skills</span>
                  </span>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={profileSkillInput}
                      onChange={(event) => setProfileSkillInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addProfileSkill();
                        }
                      }}
                      placeholder="Search or create skill"
                      className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => addProfileSkill()}
                      className="inline-flex h-12 items-center rounded-xl border border-indigo-200 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                    >
                      {filteredProfileSkillSuggestions.some(
                        (entry) => toSkillKey(entry.label) === toSkillKey(profileSkillInput)
                      )
                        ? "Add"
                        : `Create`}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filteredProfileSkillSuggestions.length ? (
                      filteredProfileSkillSuggestions.map((skillOption) => {
                        const skillKey = toSkillKey(skillOption.key || skillOption.label);
                        const active = onboardingAdvancedSkills.some(
                          (entry) => toSkillKey(entry) === skillKey
                        );
                        return (
                          <button
                            key={`profile-skill-suggestion-${skillKey}`}
                            type="button"
                            onClick={() => addProfileSkill(skillOption.label)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              active
                                ? "border border-indigo-100 bg-indigo-50 text-indigo-700"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                            }`}
                          >
                            {skillOption.label}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500">
                        Type a skill name to search existing tags or create a new one.
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <CheckCircle size={14} />
                    <span>{t("profile.selectedSkills", { defaultValue: "Selected Skills" })}</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {onboardingAdvancedSkills.length ? (
                      onboardingAdvancedSkills.map((skillKey) => (
                        <span
                          key={`profile-selected-skill-${skillKey}`}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                        >
                          <span>{toProfessionalSkillLabel(skillKey)}</span>
                          {newlyCreatedProfileSkillKeys.includes(toSkillKey(skillKey)) ? (
                            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              New
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleAdvancedSkill(skillKey)}
                            className="rounded-full text-indigo-600 transition hover:text-indigo-800"
                            aria-label={`Remove ${skillKey}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No skills selected yet.</span>
                    )}
                  </div>
                </div>

                {showProfileSkillAiTip ? (
                  <p className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
                    You've updated your skills! Click Suggest below to refresh your experience with new professional text
                  </p>
                ) : null}
              </div>
            </>
          ) : showCompanyPreview ? (
            <div
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("profile.companySummary", { defaultValue: "Company Summary" })}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCompanyPreview(false)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={13} />
                  <span>{t("common.edit", { defaultValue: "Edit" })}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 text-indigo-600" size={15} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {t("profile.companyBio", { defaultValue: "Company Bio" })}
                      </p>
                      <p className="break-all text-sm leading-snug text-slate-800">
                        {form.companyDescription ||
                          t("common.notProvided", { defaultValue: "Not Provided" })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <FaMapMarkerAlt className="mt-0.5 text-indigo-600" size={15} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {t("profile.companyLocation", { defaultValue: "Company Location" })}
                      </p>
                      <p className="break-all text-sm leading-snug text-slate-800">
                        {form.companyAddress ||
                          t("common.notAvailable", { defaultValue: "Not available" })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <Users className="mt-0.5 text-indigo-600" size={15} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {t("profile.companySize", { defaultValue: "Company Size" })}
                      </p>
                      <p className="break-all text-sm leading-snug text-slate-800">
                        {form.companySize ||
                          t("common.notProvided", { defaultValue: "Not Provided" })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <FaTelegramPlane className="mt-0.5 text-indigo-600" size={15} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {t("profile.businessTelegram", { defaultValue: "Business Telegram" })}
                      </p>
                      <p className="break-all text-sm leading-snug text-slate-800">
                        {form.businessTelegramUsername ||
                          t("common.notAvailable", { defaultValue: "Not available" })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                  <div className="flex items-start gap-2">
                    <FaPhoneAlt className="mt-0.5 text-indigo-600" size={14} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {t("profile.businessPhone", { defaultValue: "Business Phone" })}
                      </p>
                      <p className="break-all text-sm leading-snug text-slate-800">
                        {form.businessPhoneNumber ||
                          t("common.notAvailable", { defaultValue: "Not available" })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
                  <div className="flex items-start gap-2">
                    <FaFileAlt className="mt-0.5 text-indigo-600" size={14} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {t("profile.businessRegistration", {
                          defaultValue: "Business Registration (Optional)",
                        })}
                      </p>
                      <p className="break-all text-sm leading-snug text-slate-800">
                        {form.businessRegistration ||
                          t("common.notProvided", { defaultValue: "Not Provided" })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Building2 size={14} />
                  <span>{t("employer.companyName", { defaultValue: "Company Name" })}</span>
                </span>
                <div className="flex items-center gap-3">
                  <LazyAvatar
                    src={companyLogoDisplayUrl}
                    alt={form.companyName || "Company"}
                    name={form.companyName || "CO"}
                    className="h-16 w-16 rounded-full border border-slate-200 bg-white"
                    textClassName="text-base"
                  />
                  <input
                    type="text"
                    value={form.companyName}
                    onChange={(event) => handleProfileChange("companyName", event.target.value)}
                    placeholder="Acme Logistics Ltd"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Building2 size={14} />
                  <span>{t("profile.companyLogo", { defaultValue: "Company Logo" })}</span>
                </span>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <LazyAvatar
                      src={companyLogoDisplayUrl}
                      alt={form.companyName || "Company Logo"}
                      name={form.companyName || "CO"}
                      className="h-14 w-14 rounded-full"
                      textClassName="text-sm"
                    />
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => companyLogoInputRef.current?.click()}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700"
                      >
                        <Upload size={13} />
                        <span>
                          {selectedCompanyLogoFile
                            ? t("profile.changeLogo", { defaultValue: "Change Logo" })
                            : t("profile.chooseLogo", { defaultValue: "Choose Logo" })}
                        </span>
                      </button>
                      <input
                        ref={companyLogoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleCompanyLogoSelect}
                        className="hidden"
                      />
                      <p className="mt-2 text-[11px] text-slate-500">
                        Recommended size: 500x500px. PNG or JPG.
                      </p>
                    </div>
                  </div>
                  {selectedCompanyLogoFile ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleCompanyLogoUpload}
                        disabled={isUploadingCompanyLogo}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <Upload size={13} />
                        <span>
                          {isUploadingCompanyLogo
                            ? t("profile.uploading", { defaultValue: "Uploading..." })
                            : t("profile.uploadLogo", { defaultValue: "Upload" })}
                        </span>
                      </button>
                      {isUploadingCompanyLogo || logoUploadProgress > 0 ? (
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                            style={{ width: `${logoUploadProgress}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Building2 size={14} />
                  <span>{t("profile.companyCover", { defaultValue: "Company Cover" })}</span>
                </span>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {companyCoverDisplayUrl ? (
                      <img
                        src={companyCoverDisplayUrl}
                        alt={form.companyName || "Company cover"}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-24 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => companyCoverInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700"
                    >
                      <Upload size={13} />
                      <span>
                        {selectedCompanyCoverFile
                          ? t("profile.changeCover", { defaultValue: "Change Cover" })
                          : t("profile.chooseCover", { defaultValue: "Choose Cover" })}
                      </span>
                    </button>
                    <input
                      ref={companyCoverInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleCompanyCoverSelect}
                      className="hidden"
                    />
                    {selectedCompanyCoverFile ? (
                      <button
                        type="button"
                        onClick={handleCompanyCoverUpload}
                        disabled={isUploadingCompanyCover}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <Upload size={13} />
                        <span>
                          {isUploadingCompanyCover
                            ? t("profile.uploading", { defaultValue: "Uploading..." })
                            : t("profile.uploadCover", { defaultValue: "Upload Cover" })}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Users size={14} />
                  <span>{t("profile.companySize", { defaultValue: "Company Size" })}</span>
                </span>
                <select
                  value={form.companySize}
                  onChange={(event) => handleProfileChange("companySize", event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">{t("common.selectOption", { defaultValue: "Select an option" })}</option>
                  {COMPANY_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Building2 size={14} />
                  <span>{t("profile.businessRegistration", { defaultValue: "Business Registration (Optional)" })}</span>
                </span>
                <input
                  type="text"
                  value={form.businessRegistration}
                  onChange={(event) =>
                    handleProfileChange("businessRegistration", event.target.value)
                  }
                  placeholder="REG-123456"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="block">
                <span
                  className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
                >
                  <MapPin size={14} />
                  <span>{t("profile.companyLocation", { defaultValue: "Company Location" })}</span>
                </span>
                <input
                  type="text"
                  value={form.companyAddress}
                  onChange={(event) => handleProfileChange("companyAddress", event.target.value)}
                  placeholder={t("profile.companyLocationPlaceholder", {
                    defaultValue: "Enter your company address",
                  })}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoComplete="street-address"
                />
              </div>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Building2 size={14} />
                  <span>{t("profile.companyBio", { defaultValue: "Company Bio" })}</span>
                </span>
                <textarea
                  rows={5}
                  maxLength={500}
                  value={form.companyDescription}
                  onChange={(event) =>
                    handleProfileChange("companyDescription", event.target.value)
                  }
                  placeholder={t("profile.companyBioPlaceholder", {
                    defaultValue:
                      "Describe your company and office culture to attract the best talent.",
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-xs text-slate-500">
                  {form.companyDescription.length}/500
                </p>
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Users size={14} />
                  <span>{t("profile.quickChatMethod", { defaultValue: "Quick Chat Method" })}</span>
                </span>
                <select
                  value={form.preferredContactMethod}
                  onChange={(event) =>
                    handleProfileChange("preferredContactMethod", event.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="none">{t("profile.contactNone", { defaultValue: "None" })}</option>
                  <option value="phone">{t("profile.contactPhone", { defaultValue: "Phone" })}</option>
                  <option value="telegram">{t("profile.contactTelegram", { defaultValue: "Telegram" })}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Phone size={14} />
                  <span>{t("profile.businessPhone", { defaultValue: "Business Phone" })}</span>
                </span>
                <input
                  type="text"
                  value={form.businessPhoneNumber}
                  onChange={(event) =>
                    handleProfileChange("businessPhoneNumber", event.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Send size={14} />
                  <span>{t("profile.businessTelegram", { defaultValue: "Business Telegram" })}</span>
                </span>
                <input
                  type="text"
                  value={form.businessTelegramUsername}
                  onChange={(event) =>
                    handleProfileChange("businessTelegramUsername", event.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <motion.button
              type="submit"
              disabled={isSavingProfile}
              animate={savePulse ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:shadow-[0_8px_22px_rgba(37,99,235,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              <span>
                {isSavingProfile
                  ? t("common.saving", { defaultValue: "Saving..." })
                  : isEmployer
                    ? t("profile.saveCompanySettings", { defaultValue: "Save Company Settings" })
                    : t("profile.saveProfile", { defaultValue: "Save Profile" })}
              </span>
            </motion.button>
            <button
              type="button"
              onClick={() => {
                resetProfileDraft();
                setIsEditing(false);
              }}
              disabled={isSavingProfile}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={16} />
              <span>{t("common.cancel", { defaultValue: "Cancel" })}</span>
            </button>
          </div>

          {!isEmployer ? (
            <button
              type="button"
              onClick={() => handleOpenCvPreviewModal(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              <Download size={16} />
              <span>Export to CV</span>
            </button>
          ) : null}
        </form>
        )}
      </article>

      {!isEmployer ? (
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-lg">
          <h2 className="text-sm font-semibold text-slate-900">{t("profile.handshakeLog")}</h2>
          {logError ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {logError}
            </p>
          ) : null}
          {!logError && logs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{t("profile.noHandshakeLogs")}</p>
          ) : null}
          {!logError && logs.length > 0 ? (
            <motion.ul layout className="mt-3 space-y-3">
              {logs.map((log, index) => (
                <motion.li
                  key={log._id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: index * 0.05 }}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-700 shadow-sm backdrop-blur-sm"
                >
                  <p className="text-lg font-semibold leading-tight text-indigo-600">
                    {log.jobId?.title || t("jobDetails.job")}
                  </p>
                  <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[15px] text-slate-500">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{log.jobId?.location?.address || t("jobCard.locationTbd")}</span>
                  </p>

                  <div className="mt-5">
                    <div className="grid grid-cols-4">
                      {handshakeTimelineKeys.map((stepKey, stepIndex) => (
                        <div key={`${log._id}-${stepKey}`} className="relative flex justify-center">
                          {stepIndex < 3 ? (
                            <span className="absolute left-1/2 top-1.5 h-0.5 w-full bg-indigo-200" />
                          ) : null}
                          <span className="relative z-[1] h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-[0_0_0_2px_rgba(99,102,241,0.18)]" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold tracking-wide text-slate-400 sm:text-xs">
                      <span className="justify-self-center leading-snug">{t("apply.timeline.applied", { defaultValue: "Applied" })}</span>
                      <span className="justify-self-center leading-snug">{t("apply.timeline.contracted", { defaultValue: "Contracted" })}</span>
                      <span className="justify-self-center leading-snug">{t("apply.timeline.arrived", { defaultValue: "Arrived" })}</span>
                      <span className="justify-self-center leading-snug">{t("apply.timeline.completed", { defaultValue: "Completed" })}</span>
                    </div>
                  </div>

                  <p className="mt-4 inline-flex w-full items-center justify-end gap-1.5 text-sm text-slate-500">
                    <CheckCircle size={13} className="text-emerald-500" />
                    <span>
                      {t("profile.verifiedOn")}{" "}
                      {log.handshakeAt
                        ? new Date(log.handshakeAt).toLocaleDateString()
                        : new Date(log.updatedAt).toLocaleDateString()}
                    </span>
                  </p>
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </article>
      ) : null}

      <div className="mt-8">
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 text-red-600 transition hover:bg-red-100"
          style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
        >
          <FiLogOut size={18} />
          <span className="text-sm font-semibold">ចាកចេញ</span>
        </button>
      </div>
    </section>
  );
}

export default ProfilePage;

