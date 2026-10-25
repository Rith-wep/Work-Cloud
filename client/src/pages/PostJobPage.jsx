import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaChevronUp } from "react-icons/fa/index.js";

import { useAuth } from "../context/AuthContext.jsx";
import { normalizeSkill, SKILL_SUGGESTIONS_BY_CATEGORY, toSkillKey } from "../utils/skills.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CATEGORY_OPTIONS = ["Delivery", "Cleaning", "Construction", "IT/Digital", "Teaching", "Event Staff"];

function PostJobPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const miniMapRef = useRef(null);
  const miniMapInstanceRef = useRef(null);
  const miniMapMarkerRef = useRef(null);
  const categoryMenuRef = useRef(null);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    description: "",
    salary: "",
    vacancies: 1,
    address: "",
    lat: null,
    lng: null,
    requiredSkills: [],
    isFeatured: false,
    jobType: "gig",
    category: "Delivery",
    workModeRemote: false,
    experienceRequirement: "",
  });
  const [skillInput, setSkillInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("Delivery");
  const [catalogSkills, setCatalogSkills] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const hasCoordinates = form.lat !== null && form.lng !== null;
  const activeLanguage = String(i18n.language || i18n.resolvedLanguage || "en")
    .toLowerCase()
    .split("-")[0];
  const availableCategoryOptions = Array.from(
    new Map(
      [...CATEGORY_OPTIONS.map((entry) => ({ key: toSkillKey(entry), label: entry })), ...catalogCategories].map(
        (entry) => [toSkillKey(entry.key || entry.label || ""), entry.label || entry.key]
      )
    ).entries()
  ).map(([key, label]) => ({ key, label }));
  const filteredCategoryOptions = availableCategoryOptions.filter((entry) =>
    !String(categoryInput || "").trim() ||
    toSkillKey(entry.label).includes(toSkillKey(categoryInput))
  );
  const availableSkillSuggestions = Array.from(
    new Map(
      [
        ...(SKILL_SUGGESTIONS_BY_CATEGORY[form.category] || []).map((entry) => ({
          key: toSkillKey(entry),
          label: entry,
        })),
        ...catalogSkills,
      ].map((entry) => [toSkillKey(entry.key || entry.label || ""), entry.label || entry.key])
    ).entries()
  )
    .map(([key, label]) => ({ key, label }))
    .filter((entry) => !String(skillInput || "").trim() || toSkillKey(entry.label).includes(toSkillKey(skillInput)));
  const isCustomEmployerSkill =
    Boolean(String(skillInput || "").trim()) &&
    !availableSkillSuggestions.some((entry) => toSkillKey(entry.label) === toSkillKey(skillInput));

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setIsCatalogLoading(true);
        const response = await fetch(`${API_BASE_URL}/auth/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to load catalog");
        }
        setCatalogSkills(Array.isArray(data.skills) ? data.skills : []);
        setCatalogCategories(Array.isArray(data.categories) ? data.categories : []);
      } catch {
        setCatalogSkills([]);
        setCatalogCategories([]);
      } finally {
        setIsCatalogLoading(false);
      }
    };
    if (token) {
      fetchCatalog();
    }
  }, [token]);

  useEffect(() => {
    const setupAutocomplete = () => {
      if (!window.google || !window.google.maps || !addressInputRef.current) {
        return false;
      }

      autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        fields: ["formatted_address", "geometry", "name"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        const location = place?.geometry?.location;
        if (!location) {
          setError(t("postJob.selectedAddressNoCoordinates"));
          return;
        }

        setError("");
        setForm((prev) => ({
          ...prev,
          address: place.formatted_address || place.name || prev.address,
          lat: Number(location.lat()),
          lng: Number(location.lng()),
        }));
      });

      return true;
    };

    if (setupAutocomplete()) {
      return () => {
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    }

    const interval = setInterval(() => {
      const isReady = setupAutocomplete();
      if (isReady) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCategoryInput(form.category);
  }, [form.category]);

  useEffect(() => {
    if (user?.role !== "employer") {
      return;
    }

    const hasExisting = Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng));
    if (hasExisting) {
      return;
    }

    const address = String(user?.companyLocation?.address || "").trim();
    const lat = Number(user?.companyLocation?.lat);
    const lng = Number(user?.companyLocation?.lng);

    if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      address,
      lat,
      lng,
    }));
  }, [form.lat, form.lng, user?.companyLocation?.address, user?.companyLocation?.lat, user?.companyLocation?.lng, user?.role]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!categoryMenuRef.current) return;
      if (!categoryMenuRef.current.contains(event.target)) {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!window.google || !window.google.maps || !miniMapRef.current || !hasCoordinates) {
      return;
    }

    const center = { lat: form.lat, lng: form.lng };

    if (!miniMapInstanceRef.current) {
      miniMapInstanceRef.current = new window.google.maps.Map(miniMapRef.current, {
        center,
        zoom: 15,
        disableDefaultUI: true,
      });
      miniMapMarkerRef.current = new window.google.maps.Marker({
        position: center,
        map: miniMapInstanceRef.current,
      });
      return;
    }

    miniMapInstanceRef.current.panTo(center);
    miniMapMarkerRef.current?.setPosition(center);
  }, [form.lat, form.lng, hasCoordinates]);

  const handleChange = (key, value) => {
    if (key === "address") {
      setForm((prev) => ({ ...prev, address: value, lat: null, lng: null }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddSkill = (rawSkill) => {
    const trimmed = String(rawSkill || "").trim();
    if (!trimmed) return;

    setForm((prev) => {
      const exists = prev.requiredSkills.some(
        (skill) => normalizeSkill(skill) === normalizeSkill(trimmed)
      );
      if (exists) return prev;
      return {
        ...prev,
        requiredSkills: [...prev.requiredSkills, trimmed],
      };
    });
    setSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove) => {
    setForm((prev) => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(
        (skill) => normalizeSkill(skill) !== normalizeSkill(skillToRemove)
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!hasCoordinates) {
        throw new Error(t("postJob.selectAddressFromSuggestions"));
      }
      if (!form.experienceRequirement) {
        throw new Error(
          t("postJob.selectExperience", { defaultValue: "Select experience level" })
        );
      }

      const payload = {
        title: form.title,
        description: form.description,
        salary: form.salary,
        vacancies: Math.max(1, Number(form.vacancies) || 1),
        jobType: form.jobType,
        category: form.category,
        work_mode: form.workModeRemote ? "remote" : "on_site",
        is_remote: Boolean(form.workModeRemote),
        experience_requirement: form.experienceRequirement,
        isFeatured: form.isFeatured,
        requiredSkills: form.requiredSkills
          .map((skill) => skill.trim())
          .filter(Boolean),
        location: {
          address: form.address,
          lat: form.lat,
          lng: form.lng,
        },
      };

      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || t("postJob.failedCreateJob"));
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoStep2 = form.title && form.description && form.salary;
  const canGoStep3 = hasCoordinates;

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-lg">
        <h1 className="text-2xl font-bold text-primary">{t("postJob.title")}</h1>
        <p className="text-sm text-slate-500">{t("postJob.subtitle")}</p>
        {!GOOGLE_MAPS_KEY ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {t("postJob.missingKey")}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full text-center text-xs font-semibold leading-7 ${
                  step >= item ? "bg-primary text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {item}
              </div>
              {item < 3 ? <div className="h-[2px] w-6 bg-slate-200" /> : null}
            </div>
          ))}
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-white/50 bg-white/55 p-4 shadow-lg backdrop-blur-lg"
      >
        {step === 1 ? (
          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <input
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              placeholder={t("postJob.jobTitle")}
              value={form.title}
              onChange={(event) => handleChange("title", event.target.value)}
              required
            />
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder={t("postJob.jobDescription")}
              rows={4}
              value={form.description}
              onChange={(event) => handleChange("description", event.target.value)}
              required
            />
            <input
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              placeholder={t("postJob.salary")}
              value={form.salary}
              onChange={(event) => handleChange("salary", event.target.value)}
              required
            />
            <input
              type="number"
              min={1}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              placeholder={t("postJob.numberOfOpenings", { defaultValue: "Number of Openings" })}
              value={form.vacancies}
              onChange={(event) => handleChange("vacancies", event.target.value)}
              required
            />
            <select
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={form.jobType}
              onChange={(event) => handleChange("jobType", event.target.value)}
            >
              <option value="gig">{t("dashboard.gig")}</option>
              <option value="part-time">{t("dashboard.partTime")}</option>
              <option value="full-time">{t("dashboard.fullTime")}</option>
            </select>
            <div className="relative" ref={categoryMenuRef}>
              <div className="flex gap-2">
                <input
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  value={categoryInput}
                  onChange={(event) => setCategoryInput(event.target.value)}
                  onFocus={() => setIsCategoryMenuOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const nextCategory = String(categoryInput || "").trim();
                      if (nextCategory) {
                        handleChange("category", nextCategory);
                        setIsCategoryMenuOpen(false);
                      }
                    }
                  }}
                  placeholder="Search or create category"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextCategory = String(categoryInput || "").trim();
                    if (nextCategory) {
                      handleChange("category", nextCategory);
                      setIsCategoryMenuOpen(false);
                    }
                  }}
                  className="h-12 rounded-xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-700"
                >
                  Create
                </button>
              </div>
              {isCategoryMenuOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {isCatalogLoading ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      {t("common.loading", { defaultValue: "Loading..." })}
                    </p>
                  ) : null}
                  {filteredCategoryOptions.map((category) => {
                    const isActive = toSkillKey(form.category) === toSkillKey(category.label);
                    return (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => {
                          handleChange("category", category.label);
                          setIsCategoryMenuOpen(false);
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                          isActive ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className="truncate">{category.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("postJob.workMode", { defaultValue: "Work Mode" })}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChange("workModeRemote", false)}
                  className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                    !form.workModeRemote
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                  }`}
                >
                  {t("postJob.onSite", { defaultValue: "On-site" })}
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("workModeRemote", true)}
                  className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                    form.workModeRemote
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                  }`}
                >
                  {t("postJob.remote", { defaultValue: "Remote" })}
                </button>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("postJob.experienceRequirement", { defaultValue: "Experience Requirement" })}
              </label>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={form.experienceRequirement}
                onChange={(event) => handleChange("experienceRequirement", event.target.value)}
                required
              >
                <option value="">
                  {t("postJob.selectExperience", { defaultValue: "Select experience level" })}
                </option>
                <option value="no_experience">
                  {t("postJob.noExperience", { defaultValue: "No Experience" })}
                </option>
                <option value="junior">
                  {t("postJob.junior", { defaultValue: "Junior (1-2 years)" })}
                </option>
                <option value="senior">
                  {t("postJob.senior", { defaultValue: "Senior (3+ years)" })}
                </option>
              </select>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("postJob.requiredSkills")}
              </label>
              <div className="flex flex-wrap gap-2">
                {form.requiredSkills.map((skill) => (
                  <span
                    key={`step1-${skill}`}
                    className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 whitespace-nowrap ${
                      activeLanguage === "km"
                        ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
                        : ""
                    }`}
                  >
                    <span className="whitespace-nowrap">
                      {t(`skills.${toSkillKey(skill)}`, { defaultValue: skill })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="rounded-full px-1 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
                      aria-label={`Remove ${skill}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  placeholder={t("postJob.addSkillPlaceholder", { defaultValue: "Type a skill and press Enter" })}
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddSkill(skillInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddSkill(skillInput)}
                  className="h-10 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white"
                >
                  {t("postJob.addSkill", { defaultValue: "Add" })}
                </button>
              </div>
              {isCustomEmployerSkill ? (
                <p className="text-xs text-indigo-600">
                  This skill will be added to the WorkCloud catalog for all users
                </p>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">
                  {t("postJob.suggestedSkills", { defaultValue: "Suggested skills" })}
                </p>
                {isCatalogLoading ? (
                  <p className="text-xs text-slate-500">
                    {t("common.loading", { defaultValue: "Loading..." })}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {availableSkillSuggestions.map((skill) => (
                    <button
                      key={`step1-${form.category}-${skill.key}`}
                      type="button"
                      onClick={() => handleAddSkill(skill.label)}
                      className={`rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap ${
                        activeLanguage === "km"
                          ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
                          : ""
                      }`}
                    >
                      {t(`skills.${toSkillKey(skill.label)}`, {
                        defaultValue: skill.label,
                      })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <input
              ref={addressInputRef}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              placeholder={t("postJob.searchSelectAddress")}
              value={form.address}
              onChange={(event) => handleChange("address", event.target.value)}
              autoComplete="street-address"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                placeholder={t("postJob.latitude")}
                value={form.lat ?? ""}
                readOnly
              />
              <input
                type="text"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                placeholder={t("postJob.longitude")}
                value={form.lng ?? ""}
                readOnly
              />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <div ref={miniMapRef} className="h-44 w-full" />
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) => handleChange("isFeatured", event.target.checked)}
              />
              {t("postJob.markFeatured")}
            </label>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                {form.title || t("postJob.untitledJob")}
              </p>
              <p>{form.salary || t("postJob.salaryPending")}</p>
              <p>
                {Math.max(1, Number(form.vacancies) || 1)}{" "}
                {t("postJob.openingsPreview", { defaultValue: "openings" })}
              </p>
              <p>{form.address || t("postJob.addressPending")}</p>
              {form.requiredSkills.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.requiredSkills.slice(0, 3).map((skill) => (
                    <span
                      key={`preview-${skill}`}
                      className={`rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 whitespace-nowrap ${
                        activeLanguage === "km"
                          ? "[font-family:'Kantumruy_Pro','Koh_Santepheap',sans-serif]"
                          : ""
                      }`}
                    >
                      {t(`skills.${toSkillKey(skill)}`, {
                        defaultValue: skill,
                      })}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
            disabled={step === 1}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {t("common.back")}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(3, prev + 1))}
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
              className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("common.continue")}
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !hasCoordinates || !form.experienceRequirement}
              className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? t("postJob.posting") : t("postJob.postJob")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default PostJobPage;
