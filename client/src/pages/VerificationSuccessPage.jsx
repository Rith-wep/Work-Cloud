import { AnimatePresence, motion } from "framer-motion";
import { Award, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const getTrustMeta = (score) => {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));
  if (normalized >= 80) {
    return { level: "Gold", color: "text-emerald-600", bg: "bg-emerald-100" };
  }
  if (normalized >= 40) {
    return { level: "Silver", color: "text-blue-600", bg: "bg-blue-100" };
  }
  return { level: "Bronze", color: "text-violet-600", bg: "bg-violet-100" };
};

function VerificationSuccessPage() {
  const { token, refreshCurrentUser, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const fallbackTrust = Number(user?.trustScore || 0);

  useEffect(() => {
    const onVerified = (event) => {
      setCelebrate(true);
      if (event?.detail) {
        setVerificationResult(event.detail);
      }
    };
    window.addEventListener("verification:completed", onVerified);
    return () => window.removeEventListener("verification:completed", onVerified);
  }, []);

  useEffect(() => {
    const finalizePayment = async () => {
      try {
        setIsLoading(true);
        setError("");
        const paymentRef = String(searchParams.get("paymentRef") || "").trim();
        const tranId = String(searchParams.get("tran_id") || "").trim();
        const provider = String(searchParams.get("provider") || "bakong_khqr").trim();
        const status = String(searchParams.get("status") || "success").trim();

        const response = await fetch(`${API_BASE_URL}/payments/verification/finalize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentRef,
            tran_id: tranId,
            provider,
            status,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Failed to finalize verification payment");
        }
        await refreshCurrentUser();
        setVerificationResult(data);
        setCelebrate(true);
      } catch (err) {
        setError(err.message || "Failed to finalize verification payment");
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      finalizePayment();
    }
  }, [refreshCurrentUser, searchParams, token]);

  const trustScore = Number(verificationResult?.trustScore ?? fallbackTrust);
  const trustMeta = useMemo(() => getTrustMeta(trustScore), [trustScore]);

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div
        className="relative overflow-hidden rounded-[32px] border border-indigo-100 bg-white p-8 shadow-[0_20px_55px_rgba(79,70,229,0.14)]"
        style={{ fontFamily: "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif" }}
      >
        <AnimatePresence>
          {celebrate ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
            >
              {Array.from({ length: 12 }).map((_, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: [0, 1, 0], y: [-10, -80, -130], x: [0, (index % 2 === 0 ? 24 : -24), 0] }}
                  transition={{ duration: 1.8, delay: index * 0.08 }}
                  className="absolute left-1/2 top-1/2 text-indigo-400"
                >
                  <Sparkles size={18} />
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {isLoading ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">កំពុងផ្ទៀងផ្ទាត់ការទូទាត់...</h1>
            <p className="text-sm text-slate-500">We are confirming your verification payment and updating your rank.</p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Award size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verification Pending</h1>
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : null}

        {!isLoading && !error ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 text-center"
          >
            <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-[0_12px_30px_rgba(79,70,229,0.3)]">
              <Sparkles size={30} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">ការផ្ទៀងផ្ទាត់បានជោគជ័យ</h1>
              <p className="mt-2 text-sm text-slate-600">
                Your verification is complete. Your profile has been upgraded in real time.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl bg-indigo-50/70 p-5 text-left sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Trust Score</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{trustScore}</p>
                <p className="mt-1 text-sm text-emerald-600">+10 applied</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current Rank</p>
                <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${trustMeta.bg} ${trustMeta.color}`}>
                  <Award size={16} />
                  <span>{trustMeta.level}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Verified badge has been added to your profile.</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}

export default VerificationSuccessPage;
