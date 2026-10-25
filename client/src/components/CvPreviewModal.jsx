import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, X } from "lucide-react";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
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
const toTitleCaseWords = (value) =>
  String(value || "")
    .split(" ")
    .map((entry) => (entry ? `${entry[0].toUpperCase()}${entry.slice(1).toLowerCase()}` : ""))
    .join(" ")
    .trim();
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
const sanitizeCvText = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const parseEducationEntry = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)(?:\s*\(([^()]*)\))?$/);
  const title = sanitizeCvText(match?.[1] || text);
  const rawDateRange = String(match?.[2] || "").trim();
  const dateMatch = rawDateRange.match(/^([^()]*)\s*-\s*([^()]*)$/);
  const startDate = sanitizeCvText(dateMatch?.[1] || "");
  const endDate = sanitizeCvText(dateMatch?.[2] || "");
  return {
    title,
    dateRange: `${startDate || "MM/YYYY"} - ${endDate || "End Date"}`,
  };
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
const normalizeCvSkillEntry = (skill, index = 0) => {
  const label = toProfessionalSkillLabel(skill);
  if (!label) {
    return null;
  }
  const normalizedKey = getNormalizedSkillKey(skill) || `skill_${index}`;
  return {
    id: `${normalizedKey}_${index}`,
    label,
    isVerified: Boolean(typeof skill === "object" && skill !== null && skill.isVerified),
    group: SOFT_SKILL_KEYS.has(normalizedKey) ? "soft" : "hard",
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
const imageBaseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
const toAbsoluteImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  return `${imageBaseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

function CvPreviewModal({
  isOpen,
  title = "CV Preview",
  data,
  forceVerifiedBadge = false,
  onClose,
  onDownload,
  downloadLabel = "Download PDF",
  isDownloading = false,
}) {
  const [scale, setScale] = useState(0.65);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const updateScale = () => {
      const viewportWidth = window.innerWidth || 1200;
      const viewportHeight = window.innerHeight || 800;
      const isMobile = viewportWidth < 640;
      const horizontalPadding = isMobile ? 16 : 56;
      const verticalReserved = isMobile ? 250 : 212;
      const availableWidth = Math.max(220, viewportWidth - horizontalPadding);
      const availableHeight = Math.max(260, viewportHeight - verticalReserved);
      const fittedScale = Math.min(availableWidth / A4_WIDTH, availableHeight / A4_HEIGHT);
      const next = Math.max(isMobile ? 0.24 : 0.36, Math.min(isMobile ? 0.5 : 1, fittedScale));
      setScale(Number(next.toFixed(3)));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [isOpen]);

  const cvData = useMemo(() => {
    const snapshot = data || {};
    return {
      fullName: String(snapshot.fullName || "Candidate").trim(),
      headline: String(snapshot.headline || "Professional Candidate").trim(),
      summary: String(snapshot.summary || "").trim(),
      profilePicture: toAbsoluteImageUrl(snapshot.profilePicture || snapshot.photo || ""),
      contact: {
        phone: String(snapshot.contact?.phone || "-").trim(),
        email: String(snapshot.contact?.email || "-").trim(),
        telegram: String(snapshot.contact?.telegram || "-").trim(),
      },
      skills: Array.isArray(snapshot.skills)
        ? snapshot.skills.map((skill, index) => normalizeCvSkillEntry(skill, index)).filter(Boolean)
        : [],
      languages: Array.isArray(snapshot.languages)
        ? snapshot.languages.map((entry) => sanitizeCvText(entry)).filter(Boolean)
        : [],
      experiences: Array.isArray(snapshot.experiences) ? snapshot.experiences : [],
      education: Array.isArray(snapshot.education)
        ? snapshot.education
            .map((entry) =>
              typeof entry === "object" && entry !== null
                ? {
                    title: sanitizeCvText(entry.title || ""),
                    dateRange: sanitizeCvText(entry.dateRange || "") || "MM/YYYY - End Date",
                  }
                : parseEducationEntry(entry)
            )
            .filter((entry) => entry.title)
        : [],
      isVerified: Boolean(forceVerifiedBadge || snapshot.isVerified),
    };
  }, [data, forceVerifiedBadge]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-slate-900/70 backdrop-blur-[2px]">
      <div className="sticky top-0 z-20 mx-3 mt-3 flex items-center justify-between rounded-2xl border border-white/20 bg-white/95 px-4 py-3 shadow-sm sm:mx-6 sm:px-6">
        <div className="min-w-0">
          <h2
            className="truncate text-base font-bold text-indigo-700 sm:text-lg"
            style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
          >
            {title}
          </h2>
          <p className="text-xs text-slate-600 sm:text-sm">
            Verify content before sharing or download.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex flex-1 items-start justify-center overflow-auto px-2 py-3 sm:px-5">
        <div
          className="relative mx-auto"
          style={{
            width: `${A4_WIDTH * scale}px`,
            height: `${A4_HEIGHT * scale}px`,
          }}
        >
          <div
            className="absolute left-0 top-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg"
            style={{
              width: `${A4_WIDTH}px`,
              height: `${A4_HEIGHT}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
            }}
          >
            <div className="grid h-full grid-cols-[30%_70%]">
                <aside className="h-full bg-[#F3F4F6] px-5 py-6">
                  <div className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-sm bg-slate-300">
                    {cvData.profilePicture ? (
                      <img
                        src={cvData.profilePicture}
                        alt={cvData.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-slate-600">
                        {cvData.fullName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="text-[32px] font-bold leading-none text-indigo-600">Contact</h3>
                  <div className="mt-1 border-t border-indigo-100 pt-2 text-sm text-slate-800">
                    <p>Phone: {cvData.contact.phone}</p>
                    <p className="break-all">Email: {cvData.contact.email}</p>
                    <p>Telegram: {cvData.contact.telegram}</p>
                  </div>

                  <h3 className="mt-4 text-[32px] font-bold leading-none text-indigo-600">Skills</h3>
                  <div className="mt-1 border-t border-indigo-100 pt-2">
                    {(() => {
                      const groupedSkills = groupCvSkills(cvData.skills);
                      const chipClass =
                        "inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700";
                      const chipStyle = {
                        fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif",
                      };
                      return groupedSkills.hard.length || groupedSkills.soft.length ? (
                        <div className="space-y-3">
                          {groupedSkills.hard.length ? (
                            <div>
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-600">
                                Hard Skills
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {groupedSkills.hard.map((skill) => (
                                  <span key={skill.id} className={chipClass} style={chipStyle}>
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
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-600">
                                Soft Skills
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {groupedSkills.soft.map((skill) => (
                                  <span key={skill.id} className={chipClass} style={chipStyle}>
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

                  <h3 className="mt-4 text-[32px] font-bold leading-none text-indigo-600">Languages</h3>
                  <div className="mt-1 border-t border-indigo-100 pt-2 text-sm text-slate-800">
                    <p>{cvData.languages.length ? cvData.languages.join(", ") : "-"}</p>
                  </div>
                </aside>

                <main className="h-full bg-white">
                  <div className="relative border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <h1 className="text-4xl font-semibold text-slate-900">{cvData.fullName}</h1>
                    <p className="mt-1 text-[22px] text-slate-600">{cvData.headline}</p>
                    {cvData.isVerified ? (
                      <span className="absolute right-6 top-5 inline-flex rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                        WorkCloud Verified
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-4 px-6 py-5">
                    <section>
                      <h3 className="text-[36px] font-bold leading-none text-indigo-600">Summary</h3>
                      <div className="mt-1 border-t border-indigo-100 pt-1.5 text-[17px] leading-relaxed text-slate-900">
                        {cvData.summary || "No summary provided."}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[36px] font-bold leading-none text-indigo-600">Experience</h3>
                      <div className="mt-1 border-t border-indigo-100 pt-1.5 text-[17px] text-slate-900">
                        <ul className="list-disc space-y-2 pl-5">
                          {cvData.experiences.length ? (
                            cvData.experiences.map((experience, index) => (
                              <li key={`preview-exp-${index}`} className="leading-relaxed">
                                <span className="font-semibold">
                                  {experience.title} ({experience.dateRange || "MM/YYYY - Present"})
                                </span>
                                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                  {Array.isArray(experience.bullets) && experience.bullets.length ? (
                                    experience.bullets.map((bullet, bulletIndex) => (
                                      <li key={`preview-exp-${index}-bullet-${bulletIndex}`}>{bullet}</li>
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
                      <h3 className="text-[36px] font-bold leading-none text-indigo-600">Education</h3>
                      <div className="mt-1 border-t border-indigo-100 pt-1.5 text-[17px] text-slate-900">
                        <ul className="list-disc space-y-1 pl-5">
                          {cvData.education.length ? (
                            cvData.education.map((item, index) => (
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
          onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-transparent px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
        >
          Back to Edit
        </button>
        {onDownload ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
          >
            <Download size={15} />
            <span>{isDownloading ? "Generating..." : downloadLabel}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default CvPreviewModal;
