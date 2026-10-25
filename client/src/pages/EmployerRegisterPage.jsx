import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { toastError, toastSuccess } from "../utils/toast.jsx";

function EmployerRegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    rememberMe: true,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isNameValid = form.name.trim().length >= 2;
  const isCompanyNameValid = form.companyName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const isPasswordValid = form.password.length >= 6;

  const inputStateClass = (isValid, hasValue) => {
    if (!hasValue) {
      return "border-slate-200 focus:ring-primary/20";
    }
    return isValid
      ? "border-emerald-500 focus:ring-emerald-200"
      : "border-rose-500 focus:ring-rose-200";
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: "employer",
        rememberMe: form.rememberMe,
      });

      toastSuccess("Company account created");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      toastError(err.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 via-slate-50 to-white px-4 py-8 sm:px-6">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">{t("employer.registerCompany", { defaultValue: "Register Your Company" })}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Join the cloud platform powered by data-driven trust.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {t("employer.registerSubtitle", { defaultValue: "Create your employer workspace and start hiring with trust signals." })}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="owner-name">
              {t("auth.fullName", { defaultValue: "Full Name" })}
            </label>
            <input
              id="owner-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder={t("employer.hiringManagerName", { defaultValue: "Hiring manager or owner name" })}
              className={`h-12 w-full rounded-xl border px-3 text-sm outline-none transition focus:ring ${inputStateClass(
                isNameValid,
                form.name.trim().length > 0
              )}`}
              required
            />
          </div>

            <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="company-name">
              {t("employer.companyName", { defaultValue: "Company Name" })}
            </label>
            <input
              id="company-name"
              type="text"
              value={form.companyName}
              onChange={(event) => handleChange("companyName", event.target.value)}
              placeholder={t("employer.companyNamePlaceholder", { defaultValue: "Your company name" })}
              className={`h-12 w-full rounded-xl border px-3 text-sm outline-none transition focus:ring ${inputStateClass(
                isCompanyNameValid,
                form.companyName.trim().length > 0
              )}`}
            />
          </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="employer-email">
              {t("employer.workEmail", { defaultValue: "Work Email" })}
            </label>
            <input
              id="employer-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              placeholder="hr@company.com"
              className={`h-12 w-full rounded-xl border px-3 text-sm outline-none transition focus:ring ${inputStateClass(
                isEmailValid,
                form.email.trim().length > 0
              )}`}
              required
            />
          </div>

            <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="employer-password">
              {t("auth.password", { defaultValue: "Password" })}
            </label>
            <div className="relative">
              <input
                id="employer-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
                placeholder={t("auth.minPassword", { defaultValue: "Minimum 6 characters" })}
                className={`h-12 w-full rounded-xl border px-3 pr-11 text-sm outline-none transition focus:ring ${inputStateClass(
                  isPasswordValid,
                  form.password.length > 0
                )}`}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.rememberMe}
              onChange={(event) => handleChange("rememberMe", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary"
            />
            {t("auth.keepSignedIn", { defaultValue: "Keep me signed in" })}
          </label>

          {error ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 text-sm font-semibold text-white transition hover:from-indigo-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? t("employer.creatingCompany", { defaultValue: "Creating company account..." })
              : t("employer.registerCompany", { defaultValue: "Register Your Company" })}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {t("auth.haveAccount", { defaultValue: "Already have an account?" })}{" "}
          <Link to="/login" className="font-semibold text-primary">
            {t("auth.signIn", { defaultValue: "Sign In" })}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default EmployerRegisterPage;
