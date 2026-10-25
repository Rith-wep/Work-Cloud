import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CheckCircle, Copy, LoaderCircle, QrCode, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import BakongQrCode from "./BakongQrCode.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const PAYMENT_POLL_INTERVAL_MS = 5000;
const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;
const KANTUMRUY_FONT = "\"Kantumruy Pro\", \"Koh Santepheap\", sans-serif";

function CandidateVerificationModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { refreshCurrentUser, token } = useAuth();
  const pollingRef = useRef(null);

  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("idle");
  const pollStartedAtRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      setIsStartingCheckout(false);
      setTransactionId("");
      setQrCode("");
      setCopied(false);
      setError("");
      setPhase("idle");
      pollStartedAtRef.current = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!copied) return undefined;
    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  useEffect(() => {
    const shouldPoll = Boolean(transactionId) && Boolean(qrCode);
    if (!isOpen || !token || !shouldPoll) {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return undefined;
    }

    let disposed = false;

    const pollPaymentStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/payments/status/${encodeURIComponent(transactionId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to check payment status");
        }

        const status = String(data.status || "").toUpperCase();
        const providerStatus = String(data.providerStatus || "").toUpperCase();
        if (status === "PAID") {
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          await refreshCurrentUser().catch(() => null);
          window.dispatchEvent(
            new CustomEvent("verification:completed", {
              detail: data,
            })
          );
          if (!disposed) {
            setPhase("success");
            window.setTimeout(() => {
              onClose();
            }, 1100);
          }
          return;
        }

        const timedOut =
          pollStartedAtRef.current > 0 &&
          Date.now() - pollStartedAtRef.current >= PAYMENT_TIMEOUT_MS;
        if (status === "FAILED" || status === "CANCELLED" || status === "TIMEOUT" || providerStatus === "TIMEOUT" || timedOut) {
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (!disposed) {
            setError(
              status === "TIMEOUT" || providerStatus === "TIMEOUT" || timedOut
                ? "Payment timed out. Please generate a new KHQR code and try again."
                : status === "CANCELLED"
                ? t("paywall.paymentCancelled", { defaultValue: "Payment was cancelled." })
                : t("paywall.paymentFailed", { defaultValue: "Payment was not completed." })
            );
            setPhase("idle");
            setIsStartingCheckout(false);
          }
        }
      } catch (pollError) {
        if (!disposed) {
          setError(pollError.message || "Unable to check payment status");
        }
      }
    };

    pollPaymentStatus();
    pollingRef.current = window.setInterval(pollPaymentStatus, PAYMENT_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, onClose, qrCode, refreshCurrentUser, t, token, transactionId]);

  const startCheckout = async () => {
    try {
      setIsStartingCheckout(true);
      setError("");
      setTransactionId("");
      setQrCode("");
      setPhase("generating");

      const response = await fetch(`${API_BASE_URL}/payments/verification/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: "bakong_khqr" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to initiate payment");
      }

      const nextTransactionId = String(
        data?.checkout?.providerTransactionId ||
          data?.transactionId ||
          data?.checkout?.tran_id ||
          data?.tran_id ||
          ""
      ).trim();
      const nextQrCode = String(
        data?.checkout?.qrCode || data?.checkout?.qrString || data?.qrCode || data?.qrString || ""
      ).trim();

      if (!nextTransactionId || !nextQrCode) {
        throw new Error("Bakong KHQR payment data was not returned");
      }

      setTransactionId(nextTransactionId);
      setQrCode(nextQrCode);
      setPhase("ready");
      pollStartedAtRef.current = Date.now();
    } catch (checkoutError) {
      setError(checkoutError.message || "Failed to initiate payment");
      setPhase("idle");
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const copyQrCode = async () => {
    if (!qrCode) return;

    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
    } catch {
      setError(
        t("paywall.copyFailed", {
          defaultValue: "Unable to copy the payment code right now.",
        })
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]">
      <div className="flex min-h-full items-center justify-center">
        <div
          className="relative mx-auto flex w-full max-w-[400px] flex-col overflow-hidden rounded-[28px] border border-red-100 bg-[linear-gradient(180deg,#FFF7F6_0%,#FFFFFF_36%)] p-5 shadow-[0_24px_60px_rgba(127,29,29,0.16)]"
          style={{ fontFamily: KANTUMRUY_FONT, lineHeight: 1.6 }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(220,38,38,0.22),_transparent_62%)]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-white/90 text-slate-400 shadow-sm transition hover:border-red-200 hover:text-slate-700"
          >
            <X size={15} />
          </button>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-700">
              <ShieldCheck size={12} />
              Bakong KHQR
            </div>

            <h3 className="mt-4 text-[22px] font-bold tracking-tight text-slate-950">
              {t("paywall.verifyTitle", { defaultValue: "Verification Required" })}
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Verify your account with a KHQR payment to unlock your badge and priority visibility.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-red-100 bg-white/90 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">
                Payment Amount
              </p>
              <p className="text-lg font-bold text-slate-950">USD 1.00</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!qrCode && phase !== "success" ? (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mt-5 rounded-[24px] border border-dashed border-red-200 bg-white/90 p-5 text-center"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                  {isStartingCheckout ? (
                    <LoaderCircle size={24} className="animate-spin" />
                  ) : (
                    <QrCode size={24} />
                  )}
                </div>

                <p className="mt-4 text-sm font-semibold text-slate-900">
                  {isStartingCheckout
                    ? "Generating QR"
                    : "Generate a KHQR code for account verification."}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Open your banking app, scan the QR, and we will update your verification once the Bakong payment status changes.
                </p>
              </motion.div>
            ) : null}

            {qrCode && phase === "ready" ? (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mt-5 space-y-4"
              >
                <BakongQrCode value={qrCode} />

                <div
                  className="flex items-center justify-center gap-2 text-xs text-slate-500"
                  style={{ fontFamily: KANTUMRUY_FONT }}
                >
                  <LoaderCircle size={14} className="animate-spin text-red-500" />
                  <span>Checking payment status...</span>
                </div>

                <div className="rounded-2xl border border-red-100 bg-[#FFF4F3] px-4 py-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-red-700">
                    <CheckCircle size={16} />
                    <span>Show KHQR</span>
                  </div>
                  <p className="mt-2">
                    Scan this code with a KHQR-enabled banking app. We are polling the Bakong payment status for reference <span className="font-mono text-xs text-slate-900">{transactionId}</span>.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {t("paywall.qrPayloadLabel", {
                        defaultValue: "KHQR payload",
                      })}
                    </p>

                    <button
                      type="button"
                      onClick={copyQrCode}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                      style={{ fontFamily: KANTUMRUY_FONT }}
                    >
                      <Copy size={13} />
                      <span>
                        {copied
                          ? t("common.copied", { defaultValue: "Copied" })
                          : t("common.copy", { defaultValue: "Copy" })}
                      </span>
                    </button>
                  </div>

                  <p className="mt-3 max-h-24 overflow-auto break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                    {qrCode}
                  </p>
                </div>
              </motion.div>
            ) : null}

            {phase === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mt-5 rounded-[24px] border border-emerald-100 bg-white p-6 text-center shadow-[0_18px_38px_rgba(5,150,105,0.12)]"
                style={{ fontFamily: KANTUMRUY_FONT }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle size={28} />
                </div>
                <p className="mt-4 text-lg font-bold text-slate-950">Success</p>
                <p className="mt-2 text-sm text-slate-600">
                  Your verification payment is complete and your dashboard is updating now.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {!qrCode && phase !== "success" ? (
            <button
              type="button"
              onClick={startCheckout}
              disabled={isStartingCheckout}
              className="mt-5 rounded-2xl bg-gradient-to-r from-[#A31111] via-[#C62828] to-[#D93838] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 hover:shadow-[0_12px_24px_rgba(198,40,40,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ fontFamily: KANTUMRUY_FONT }}
            >
              {isStartingCheckout
                ? t("common.processing", { defaultValue: "Processing..." })
                : "Pay with KHQR"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CandidateVerificationModal;
