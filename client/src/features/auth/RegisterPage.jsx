import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../shared/context/AuthContext.jsx";
import { toastError, toastSuccess } from "../../shared/utils/toast.jsx";

function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    rememberMe: true,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register({ ...form, role: "candidate" });
      toastSuccess(t("auth.registerSuccess", { defaultValue: "Account created successfully" }));
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      toastError(err.message || t("auth.registerFailed", { defaultValue: "Registration failed" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-primary">{t("auth.createAccount", { defaultValue: "Create Account" })}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("auth.registerSubtitle", { defaultValue: "Join Daily Opportunity and start earning." })}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
              {t("auth.fullName", { defaultValue: "Full Name" })}
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder={t("auth.fullNamePlaceholder", { defaultValue: "Your full name" })}
              className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary/20 transition focus:ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              {t("auth.email", { defaultValue: "Email" })}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              placeholder={t("auth.emailPlaceholder", { defaultValue: "you@example.com" })}
              className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary/20 transition focus:ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              {t("auth.password", { defaultValue: "Password" })}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
              placeholder={t("auth.minPassword", { defaultValue: "Minimum 6 characters" })}
              className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary/20 transition focus:ring"
              required
              minLength={6}
            />
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
            className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? t("auth.creatingAccount", { defaultValue: "Creating account..." })
              : t("auth.createAccount", { defaultValue: "Create Account" })}
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

export default RegisterPage;

