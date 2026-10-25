import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaBuilding, FaComments, FaShieldAlt } from "react-icons/fa/index.js";
import { useTranslation } from "react-i18next";

import LazyAvatar from "../components/LazyAvatar.jsx";

const featureCards = [
  {
    icon: FaBuilding,
    title: "Multi-Tenant Dashboard",
    description:
      "Manage all company job listings in one workspace with role-safe access and clean posting controls.",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
  },
  {
    icon: FaShieldAlt,
    title: "Reputation First",
    description:
      "Use Application Success Rate and Trust Score signals to quickly shortlist reliable candidates.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  },
  {
    icon: FaComments,
    title: "Direct Communication",
    description:
      "Connect instantly with talent through Quick Chat channels like Telegram and Phone.",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
  },
];

const topTalent = [
  {
    id: "talent-1",
    name: "Hong",
    trustScore: 410,
    profilePicture:
      "https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill,g_face/sample.jpg",
  },
  {
    id: "talent-2",
    name: "Sokha",
    trustScore: 355,
    profilePicture:
      "https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_thumb,g_face/sample.jpg",
  },
  {
    id: "talent-3",
    name: "Nita",
    trustScore: 322,
    profilePicture: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg",
  },
];

function EmployerLandingPage() {
  const { t } = useTranslation();
  const [companyCount, setCompanyCount] = useState(0);
  const targetCompanyCount = 1200;

  useEffect(() => {
    let frame = null;
    const duration = 1200;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setCompanyCount(Math.round(targetCompanyCount * progress));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  const trustGauge = useMemo(() => {
    const score = 88;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - score / 100);
    return { score, radius, circumference, offset };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-xl font-black tracking-tight text-primary">
            WorkCloud
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {t("auth.signIn", { defaultValue: "Sign In" })}
            </Link>
            <Link
              to="/register-company"
              className="rounded-xl border border-white/60 bg-white/60 px-4 py-2 text-sm font-semibold text-primary shadow-md shadow-indigo-200/70 backdrop-blur-md transition hover:shadow-[0_0_0_4px_rgba(79,70,229,0.18)]"
            >
              {t("employer.registerCompany", { defaultValue: "Register Your Company" })}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#c7d2fe_0%,_transparent_58%)]" />
        <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 pb-12 pt-12 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative z-10"
          >
            <p className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Employer Growth
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">
              Hire Reliable Talent in Cambodia with Data-Driven Trust.
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg">
              Stop wasting time on ghost applicants. Access our pool of candidates verified by our
              unique Reputation and Trust Score system.
            </p>
            <p className="mt-4 text-sm font-semibold text-emerald-700">
              Trusted by {companyCount.toLocaleString()} companies
            </p>
            <div className="mt-7">
              <Link
                to="/register-company"
                className="inline-flex h-12 items-center rounded-xl border border-white/60 bg-white/60 px-6 text-sm font-bold text-primary shadow-md shadow-indigo-200/80 backdrop-blur-md transition hover:shadow-[0_0_0_4px_rgba(79,70,229,0.18)]"
              >
                Register Your Company
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="relative z-10"
          >
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80"
                alt="Modern office collaboration"
                loading="lazy"
                decoding="async"
                className="h-[260px] w-full object-cover sm:h-[320px] md:h-[380px] lg:h-[440px]"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:py-14">
        <h2 className="text-2xl font-black md:text-3xl">Feature Highlights</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <img
                  src={card.image}
                  alt={card.title}
                  loading="lazy"
                  decoding="async"
                  className="h-40 w-full object-cover"
                />
                <div className="p-4">
                  <p className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-primary">
                    <Icon size={16} />
                  </p>
                  <h3 className="mt-3 text-base font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ scale: 1.03 }}
                    className="mt-4 inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200"
                  >
                    <span>Learn More</span>
                    <FaArrowRight size={10} />
                  </motion.button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-4 pb-4 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <h2 className="text-2xl font-black md:text-3xl">The WorkCloud Difference</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Every candidate is evaluated using verified application behavior, handshake completion,
            and employer reviews so you can hire with confidence.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Trust Score Gauge
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-28 w-28">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={trustGauge.radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <circle
                      cx="60"
                      cy="60"
                      r={trustGauge.radius}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={trustGauge.circumference}
                      strokeDashoffset={trustGauge.offset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-slate-900">{trustGauge.score}</span>
                    <span className="text-[11px] font-semibold text-emerald-700">Vetted</span>
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Score based candidate vetting</p>
                  <p className="mt-1">Application reliability, reviews, and completed handshakes.</p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Top Talent
              </p>
              <ul className="mt-3 space-y-2">
                {topTalent.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="flex items-center justify-between rounded-xl bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <LazyAvatar
                        src={candidate.profilePicture}
                        alt={candidate.name}
                        name={candidate.name}
                        className="h-9 w-9"
                        textClassName="text-xs"
                      />
                      <span className="text-sm font-semibold text-slate-800">{candidate.name}</span>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Trust {candidate.trustScore}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-10 sm:px-6">
        <h2 className="text-2xl font-black md:text-3xl">SaaS Pricing</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Free</h3>
            <p className="mt-2 text-3xl font-black">$0</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>2 Job Postings</li>
              <li>Basic Support</li>
            </ul>
          </article>

          <article className="rounded-2xl border-2 border-primary bg-white p-5 shadow-md">
            <p className="inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-primary">
              Most Popular
            </p>
            <h3 className="mt-2 text-lg font-bold">Pro</h3>
            <p className="mt-2 text-3xl font-black">$49/mo</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Unlimited Postings</li>
              <li>Featured Jobs</li>
              <li>Priority Support</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Enterprise</h3>
            <p className="mt-2 text-3xl font-black">Custom</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Custom Solutions for Agencies</li>
              <li>Advanced Onboarding</li>
              <li>Dedicated Success Manager</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}

export default EmployerLandingPage;
