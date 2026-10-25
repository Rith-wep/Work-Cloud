import crypto from "crypto";
import {
  BakongKHQR,
  MerchantInfo,
  khqrData,
} from "bakong-khqr";

import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import VerificationPayment from "../models/VerificationPayment.js";
import { getSocketIO } from "../socket/socketServer.js";
import logger from "../utils/logger.js";
import { applyTrustDelta } from "../utils/trustScore.js";

// constands data for verification payment
const VERIFICATION_AMOUNT_USD = 1;
const VERIFIED_BADGE = "Verified";
const VERIFICATION_TRUST_BONUS = 10;

// payment status constants
const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
  TIMEOUT: "timeout",
};

const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.PENDING]: "PENDING",
  [PAYMENT_STATUS.PAID]: "PAID",
  [PAYMENT_STATUS.FAILED]: "FAILED",
  [PAYMENT_STATUS.CANCELLED]: "CANCELLED",
  [PAYMENT_STATUS.TIMEOUT]: "TIMEOUT",
};

// default API URLs for ABA payway sanbox environment
const DEFAULT_QR_API_URL =
  "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/generate-qr";

// 
const DEFAULT_PURCHASE_API_URL =
  "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase";

const getRequiredEnv = (key) => String(process.env[key] || "").trim();
const FIXED_VERIFICATION_AMOUNT = "1.00";
const khqrGenerator = new BakongKHQR();
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_BAKONG_CHECK_TRANSACTION_URL =
  "https://api-bakong.nbc.org.kh/v1/check_transaction_by_md5";

const getPrimaryAppOrigin = () => {
  const directOrigin =
    getRequiredEnv("MAIN_APP_ORIGIN") ||
    getRequiredEnv("VITE_MAIN_APP_ORIGIN") ||
    getRequiredEnv("CLIENT_ORIGIN");

  if (directOrigin) return directOrigin;

  return String(process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((entry) => String(entry || "").trim())
    .find(Boolean);
};

const normalizeOriginUrl = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const ensureHttpsUrl = (label, value) => {
  const normalized = normalizeOriginUrl(value);
  if (!normalized) return "";
  if (isProduction && !normalized.startsWith("https://")) {
    throw new Error(`${label} must use HTTPS in production`);
  }
  return normalized;
};

const normalizePaywayField = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const mapPaymentStatusLabel = (status) =>
  PAYMENT_STATUS_LABELS[String(status || "").toLowerCase()] || "PENDING";

const buildReqTime = () => {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];
  return parts.join("");
};

const buildAbaTransactionId = (candidateId) => {
  const timePart = Date.now().toString(36).toUpperCase();
  const candidatePart = String(candidateId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase();

  return `WC${timePart}${candidatePart}`.slice(0, 20);
};

const buildBakongTransactionId = (candidateId) => {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  const candidatePart = String(candidateId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();

  return `BK${timePart}${randomPart}${candidatePart}`.slice(0, 24);
};

const buildCallbackUrl = (origin) => {
  const explicitCallbackUrl = getRequiredEnv("ABA_PAYWAY_CALLBACK_URL");
  if (explicitCallbackUrl) {
    return Buffer.from(explicitCallbackUrl, "utf8").toString("base64");
  }

  const normalizedOrigin = normalizeOriginUrl(origin);
  if (!normalizedOrigin) {
    return Buffer.from(
      "https://example.com/api/payments/callback",
      "utf8"
    ).toString("base64");
  }

  try {
    const url = new URL(
      "/api/payments/callback",
      `${normalizedOrigin}/`
    );

    if (["localhost", "127.0.0.1"].includes(url.hostname)) {
      return Buffer.from(
        "https://example.com/api/payments/callback",
        "utf8"
      ).toString("base64");
    }

    return Buffer.from(url.toString(), "utf8").toString("base64");
  } catch {
    return Buffer.from(
      "https://example.com/api/payments/callback",
      "utf8"
    ).toString("base64");
  }
};

const getQrApiUrl = () => {
  const directUrl = getRequiredEnv("ABA_PAYWAY_QR_URL");
  if (directUrl) return directUrl;

  const checkoutUrl = getRequiredEnv("ABA_PAYWAY_CHECKOUT_URL");
  if (checkoutUrl) {
    return checkoutUrl.replace(
      "/api/payment-gateway/v1/payments/purchase",
      "/api/payment-gateway/v1/payments/generate-qr"
    );
  }

  return DEFAULT_QR_API_URL;
};

const getPurchaseApiUrl = () =>
  getRequiredEnv("ABA_PAYWAY_CHECKOUT_URL") || DEFAULT_PURCHASE_API_URL;

const buildFrontendReturnUrl = (origin, tranId) => {
  const normalizedOrigin = normalizeOriginUrl(origin);
  if (!normalizedOrigin) return "";

  const returnUrl = new URL("/verification/success", `${normalizedOrigin}/`);
  returnUrl.searchParams.set("paymentRef", String(tranId || "").trim());
  return returnUrl.toString();
};

const buildBakongCallbackUrl = (transactionId) => {
  const explicitCallbackUrl =
    getRequiredEnv("BAKONG_CALLBACK_URL") || getRequiredEnv("CALLBACK_URL");
  if (explicitCallbackUrl) {
    try {
      const url = new URL(ensureHttpsUrl("Bakong callback URL", explicitCallbackUrl));
      if (transactionId) {
        url.searchParams.set("paymentRef", String(transactionId || "").trim());
        url.searchParams.set("provider", "bakong_khqr");
      }
      return url.toString();
    } catch {
      return explicitCallbackUrl;
    }
  }

  const apiOrigin =
    ensureHttpsUrl("API base URL", getRequiredEnv("API_BASE_URL")) ||
    ensureHttpsUrl("Main app origin", getPrimaryAppOrigin());

  if (!apiOrigin) return "";

  try {
    const url = new URL("/api/payments/verification/bakong/callback", `${apiOrigin}/`);
    if (transactionId) {
      url.searchParams.set("paymentRef", String(transactionId || "").trim());
      url.searchParams.set("provider", "bakong_khqr");
    }
    return url.toString();
  } catch {
    return "";
  }
};

const buildBakongSuccessUrl = (transactionId) => {
  const appOrigin = ensureHttpsUrl("Main app origin", getPrimaryAppOrigin());
  if (!appOrigin) return "";

  try {
    const url = new URL("/verification/success", `${appOrigin}/`);
    if (transactionId) {
      url.searchParams.set("paymentRef", String(transactionId || "").trim());
    }
    url.searchParams.set("provider", "bakong_khqr");
    url.searchParams.set("status", "success");
    return url.toString();
  } catch {
    return "";
  }
};

const buildPurchaseHash = ({ payload, apiKey }) => {
  const rawString = [
    payload.req_time,
    payload.merchant_id,
    payload.tran_id,
    payload.amount,
    payload.items,
    payload.firstname,
    payload.lastname,
    payload.email,
    payload.phone,
    payload.type,
    payload.payment_option,
    payload.continue_success_url,
    payload.currency,
  ]
    .map(normalizePaywayField)
    .join("");

  logger.debug("ABA purchase hash string generated", { rawString });
  const hash = crypto
    .createHmac("sha512", apiKey)
    .update(rawString)
    .digest("base64");
  logger.debug("ABA purchase hash generated", { hash });
  return hash;
};

const buildQrHash = ({ payload, apiKey }) => {
  const rawString = [
    payload.req_time,
    payload.merchant_id,
    payload.tran_id,
    payload.first_name,
    payload.last_name,
    payload.email,
    payload.phone,
    payload.amount,
    payload.purchase_type,
    payload.payment_option,
    payload.items,
    payload.currency,
    payload.callback_url,
    payload.return_deeplink,
    payload.custom_fields,
    payload.return_params,
    payload.payout,
    payload.lifetime,
    payload.qr_image_template,
  ]
    .map(normalizePaywayField)
    .join("");

  const hash = crypto
    .createHmac("sha512", apiKey)
    .update(rawString)
    .digest("base64");

  logger.debug("ABA QR hash string generated", { rawString });
  logger.debug("ABA QR hash generated", { hash });
  logger.info("ABA support note", {
    message: "Copy this string and send to ABA support to verify the Hash Sequence",
  });

  return hash;
};


const buildStatusHash = ({ reqTime, merchantId, tranId, apiKey }) => {
  const rawString = [reqTime, merchantId, tranId]
    .map(normalizePaywayField)
    .join("");

  return crypto.createHmac("sha512", apiKey).update(rawString).digest("base64");
};

const getTrustMeta = (score) => {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));

  if (normalized >= 80) return { level: "Gold", progress: normalized };
  if (normalized >= 40) return { level: "Silver", progress: normalized };
  return { level: "Bronze", progress: normalized };
};

const recordSystemAuditLog = async ({
  action,
  resourceType,
  resourceId = "",
  metadata = {},
}) => {
  try {
    return await AuditLog.create({
      adminId: null,
      adminName: "System",
      adminEmail: "system@workcloud.local",
      adminRole: "system",
      action,
      resourceType,
      resourceId: String(resourceId || "").trim(),
      targetIds: [],
      path: "/api/payments",
      method: "SYSTEM",
      origin: "",
      ipAddress: "",
      userAgent: "system",
      metadata,
    });
  } catch {
    return null;
  }
};

const parseProviderStatus = (providerPayload = {}) => {
  const serialized = JSON.stringify(providerPayload || {}).toLowerCase();

  if (/approved|success|paid/.test(serialized)) {
    return PAYMENT_STATUS.PAID;
  }

  if (/cancelled|canceled/.test(serialized)) {
    return PAYMENT_STATUS.CANCELLED;
  }

  if (/failed|declined|error/.test(serialized)) {
    return PAYMENT_STATUS.FAILED;
  }

  return PAYMENT_STATUS.PENDING;
};

const getBakongCheckTransactionUrl = () =>
  getRequiredEnv("BAKONG_CHECK_TRANSACTION_URL") ||
  DEFAULT_BAKONG_CHECK_TRANSACTION_URL;

const mapBakongTransactionStatus = (providerData = {}, payment = null) => {
  const responseCode = Number(providerData?.responseCode);
  const responseMessage = String(providerData?.responseMessage || "").trim();
  const normalizedMessage = responseMessage.toUpperCase();

  if (responseCode === 0 && normalizedMessage.includes("SUCCESS")) {
    return "SUCCESS";
  }

  if (normalizedMessage.includes("FAILED")) {
    return "FAILED";
  }

  if (normalizedMessage.includes("NOT FOUND")) {
    const expired =
      Number(payment?.metadata?.qrResponse?.expirationTimestamp || 0) > 0 &&
      Date.now() > Number(payment.metadata.qrResponse.expirationTimestamp);
    return expired ? "TIMEOUT" : "PENDING";
  }

  return "PENDING";
};

const isBakongProvider = (provider) =>
  ["bakong", "bakong_khqr"].includes(String(provider || "").trim().toLowerCase());

const fetchProviderPaymentStatus = async ({
  payment,
  providerTransactionId = "",
}) => {
  if (isBakongProvider(payment?.provider)) {
    const bearerToken = getRequiredEnv("BAKONG_BEARER_TOKEN");
    const checkUrl = getBakongCheckTransactionUrl();
    const md5 = String(
      payment?.metadata?.qrResponse?.md5 ||
        payment?.metadata?.providerPayload?.md5 ||
        ""
    ).trim();

    if (!bearerToken || !checkUrl || !md5) {
      return {
        ok: false,
        paymentStatus: PAYMENT_STATUS.PENDING,
        providerPayload: {
          message: "Bakong active polling environment is not configured",
          checkUrl,
          hasBearerToken: Boolean(bearerToken),
          hasMd5: Boolean(md5),
        },
      };
    }

    try {
      const response = await fetch(checkUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ md5 }),
      });

      const responseText = await response.text();
      let parsed = {};
      try {
        parsed = responseText ? JSON.parse(responseText) : {};
      } catch {
        parsed = { raw: responseText };
      }

      const bakongStatus = mapBakongTransactionStatus(parsed, payment);
      const paymentStatus =
        bakongStatus === "SUCCESS"
          ? PAYMENT_STATUS.PAID
          : bakongStatus === "TIMEOUT"
            ? PAYMENT_STATUS.TIMEOUT
            : bakongStatus === "FAILED"
            ? PAYMENT_STATUS.FAILED
            : PAYMENT_STATUS.PENDING;

      logger.info("Bakong transaction status checked", {
        transactionId: payment?.transactionId,
        providerTransactionId,
        bakongStatus,
        responseCode: parsed?.responseCode,
        responseMessage: parsed?.responseMessage,
      });

      return {
        ok: response.ok,
        paymentStatus,
        providerPayload: {
          requestPayload: { md5 },
          responseOk: response.ok,
          responseStatus: response.status,
          responseData: parsed,
          bakongStatus,
        },
      };
    } catch (error) {
      logger.error("Bakong transaction status check failed", {
        transactionId: payment?.transactionId,
        message: error.message,
      });
      return {
        ok: false,
        paymentStatus: PAYMENT_STATUS.PENDING,
        providerPayload: {
          message: error.message,
        },
      };
    }
  }

  const checkUrl = getRequiredEnv("ABA_PAYWAY_CHECK_TRANSACTION_URL");
  const merchantId = getRequiredEnv("ABA_PAYWAY_MERCHANT_ID");
  const apiKey = getRequiredEnv("ABA_PAYWAY_API_KEY");

  if (!checkUrl || !merchantId || !apiKey) {
    return {
      ok: false,
      paymentStatus: PAYMENT_STATUS.PENDING,
      providerPayload: {
        message: "ABA PayWay transaction status environment is not configured",
      },
    };
  }

  const reqTime = buildReqTime();
  const tranId = String(
    providerTransactionId ||
      payment.providerTransactionId ||
      payment.transactionId ||
      ""
  ).trim();

  if (!tranId) {
    return {
      ok: false,
      paymentStatus: PAYMENT_STATUS.PENDING,
      providerPayload: {
        message: "Transaction id is missing for provider status check",
      },
    };
  }

  const statusPayload = {
    req_time: reqTime,
    merchant_id: merchantId,
    tran_id: tranId,
    hash: buildStatusHash({
      reqTime,
      merchantId,
      tranId,
      apiKey,
    }),
  };

  try {
    const response = await fetch(checkUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(statusPayload),
    });

    const responseText = await response.text();
    let parsed = {};
    try {
      parsed = responseText ? JSON.parse(responseText) : {};
    } catch {
      parsed = { raw: responseText };
    }

    return {
      ok: response.ok,
      paymentStatus: parseProviderStatus(parsed),
      providerPayload: {
        requestPayload: {
          req_time: statusPayload.req_time,
          merchant_id: statusPayload.merchant_id,
          tran_id: statusPayload.tran_id,
        },
        responseOk: response.ok,
        responseStatus: response.status,
        responseData: parsed,
      },
    };
  } catch (error) {
    return {
      ok: false,
      paymentStatus: PAYMENT_STATUS.PENDING,
      providerPayload: {
        message: error.message,
      },
    };
  }
};

const finalizeVerifiedCandidate = async ({
  payment,
  candidate,
  providerPayload = {},
}) => {
  const alreadyVerified =
    candidate.isVerified ||
    (Array.isArray(candidate.verifiedBadges) &&
      candidate.verifiedBadges.includes(VERIFIED_BADGE));

  // Keep payment metadata/status up to date even if candidate is already verified.
  payment.status = PAYMENT_STATUS.PAID;
  payment.paidAt = payment.paidAt || new Date();
  payment.metadata = {
    ...(payment.metadata || {}),
    providerPayload,
  };

  if (alreadyVerified) {
    await payment.save();
    return candidate;
  }

  payment.save();

  const nextBadges = Array.from(
    new Set([
      ...(Array.isArray(candidate.verifiedBadges)
        ? candidate.verifiedBadges
        : []),
      VERIFIED_BADGE,
    ])
  );

  candidate.trustScore = applyTrustDelta(
    candidate.trustScore,
    VERIFICATION_TRUST_BONUS
  );
  candidate.verifiedBadges = nextBadges;
  candidate.isVerified = true;

  await Promise.all([payment.save(), candidate.save()]);

  await recordSystemAuditLog({
    action: "create",
    resourceType: "verification_payment",
    resourceId: String(payment._id),
    metadata: {
      paymentId: payment._id,
      candidateId: candidate._id,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      transactionId: payment.transactionId,
      providerTransactionId: payment.providerTransactionId,
      status: payment.status,
      revenueUsd: payment.amount,
    },
  });

  const io = getSocketIO();
  if (io) {
    io.to(`user:${String(candidate._id)}`).emit("verification_completed", {
      paymentId: payment._id,
      trustScore: Number(candidate.trustScore || 0),
      verifiedBadges: candidate.verifiedBadges || [],
      rank: getTrustMeta(candidate.trustScore).level,
      amount: payment.amount,
      currency: payment.currency,
    });
  }

  return candidate;
};

const resolveVerificationPayment = async ({
  payment,
  candidate,
  providerTransactionId = "",
  providerPayload = {},
  forceProviderCheck = true,
}) => {
  let mergedProviderPayload = { ...(providerPayload || {}) };
  let providerStatus = PAYMENT_STATUS.PENDING;

  if (payment.status === PAYMENT_STATUS.PAID) {
    return {
      ok: true,
      payment,
      candidate,
      status: PAYMENT_STATUS.PAID,
    };
  }

  if (providerTransactionId) {
    payment.providerTransactionId = providerTransactionId;
  }

  if (forceProviderCheck) {
    const providerStatusResult = await fetchProviderPaymentStatus({
      payment,
      providerTransactionId,
    });

    mergedProviderPayload = {
      ...mergedProviderPayload,
      ...(providerStatusResult.providerPayload || {}),
    };
    providerStatus = providerStatusResult.paymentStatus;
  }

  if (providerStatus === PAYMENT_STATUS.PAID) {
    const bakongStatus = String(mergedProviderPayload?.bakongStatus || "").toUpperCase();
    if (isBakongProvider(payment.provider) && bakongStatus !== "SUCCESS") {
      payment.status = PAYMENT_STATUS.PENDING;
      payment.metadata = {
        ...(payment.metadata || {}),
        providerPayload: mergedProviderPayload,
      };
      await payment.save();

      return {
        ok: false,
        payment,
        candidate,
        status: payment.status,
      };
    }

    const updatedCandidate = await finalizeVerifiedCandidate({
      payment,
      candidate,
      providerPayload: mergedProviderPayload,
    });

    return {
      ok: true,
      payment,
      candidate: updatedCandidate,
      status: PAYMENT_STATUS.PAID,
    };
  }

  if (providerStatus === PAYMENT_STATUS.CANCELLED) {
    payment.status = PAYMENT_STATUS.CANCELLED;
  } else if (providerStatus === PAYMENT_STATUS.TIMEOUT) {
    payment.status = PAYMENT_STATUS.TIMEOUT;
  } else if (providerStatus === PAYMENT_STATUS.FAILED) {
    payment.status = PAYMENT_STATUS.FAILED;
  } else {
    payment.status = PAYMENT_STATUS.PENDING;
  }

  payment.metadata = {
    ...(payment.metadata || {}),
    providerPayload: mergedProviderPayload,
  };
  await payment.save();

  return {
    ok: false,
    payment,
    candidate,
    status: payment.status,
  };
};

const findPaymentByReference = async (paymentRef = "", providerTranId = "") => {
  const localRef = String(paymentRef || "").trim();
  const providerRef = String(providerTranId || "").trim();

  if (!localRef && !providerRef) return null;

  return VerificationPayment.findOne({
    $or: [
      ...(localRef ? [{ transactionId: localRef }] : []),
      ...(providerRef ? [{ providerTransactionId: providerRef }] : []),
    ],
  });
};

const loadCandidateForVerification = async (userId) => {
  const candidate = await User.findById(userId).select(
    "name email phoneNumber trustScore verifiedBadges isVerified"
  );

  if (!candidate) {
    return {
      error: {
        status: 404,
        body: { success: false, message: "Candidate not found" },
      },
    };
  }

  if (
    candidate.isVerified ||
    (Array.isArray(candidate.verifiedBadges) &&
      candidate.verifiedBadges.includes(VERIFIED_BADGE))
  ) {
    return {
      error: {
        status: 400,
        body: { success: false, message: "Candidate is already verified" },
      },
    };
  }

  return { candidate };
};

const upsertVerificationPayment = async ({
  candidateId,
  transactionId,
  provider,
  checkoutUrl,
  amount = Number(FIXED_VERIFICATION_AMOUNT),
  metadata = {},
}) =>
  VerificationPayment.findOneAndUpdate(
    { candidateId, transactionId },
    {
      $set: {
        amount,
        currency: "USD",
        status: PAYMENT_STATUS.PENDING,
        provider,
        checkoutUrl,
        metadata,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

const buildBakongCheckout = ({ candidate, transactionId }) => {
  const bakongAccountId = getRequiredEnv("BAKONG_ACCOUNT_ID");
  const merchantId = getRequiredEnv("BAKONG_MERCHANT_ID");
  const merchantName =
    getRequiredEnv("BAKONG_MERCHANT_NAME") ||
    getRequiredEnv("MERCHANT_NAME") ||
    normalizePaywayField(candidate.name).trim() ||
    "Linklid";
  const merchantCity =
    getRequiredEnv("BAKONG_MERCHANT_CITY") || "PHNOM PENH";
  const acquiringBank = getRequiredEnv("BAKONG_ACQUIRING_BANK");
  const merchantCategoryCode =
    getRequiredEnv("BAKONG_MERCHANT_CATEGORY_CODE") || "5999";
  const mobileNumber =
    getRequiredEnv("BAKONG_MOBILE_NUMBER") ||
    normalizePaywayField(candidate.phoneNumber).trim();
  const storeLabel = getRequiredEnv("BAKONG_STORE_LABEL") || "Linklid";
  const terminalLabel =
    getRequiredEnv("BAKONG_TERMINAL_LABEL") || "Candidate Verification";
  const amountDisplay = Number(FIXED_VERIFICATION_AMOUNT).toFixed(2);
  const amountValue = Number(amountDisplay);
  const expirationMinutes = Number(getRequiredEnv("BAKONG_EXPIRATION_MINUTES") || 15);
  const billDurationSeconds = Math.max(
    60,
    Math.round((Number.isFinite(expirationMinutes) ? expirationMinutes : 15) * 60)
  );
  const expirationTimestamp = Date.now() + billDurationSeconds * 1000;

  if (!bakongAccountId || !merchantId || !acquiringBank) {
    return {
      error: {
        status: 503,
        body: {
          success: false,
          message:
            "Bakong KHQR is not configured. Set BAKONG_ACCOUNT_ID, BAKONG_MERCHANT_ID, and BAKONG_ACQUIRING_BANK.",
        },
      },
    };
  }

  const callbackUrl = buildBakongCallbackUrl(transactionId);
  const successUrl = buildBakongSuccessUrl(transactionId);
  const bakongPayload = {
    bakongAccountId,
    merchantId,
    merchantName,
    merchantCity,
    acquiringBank,
    currency: "USD",
    amount: amountDisplay,
    billNumber: transactionId,
    mobileNumber: mobileNumber || "",
    storeLabel,
    terminalLabel,
    merchantCategoryCode,
    callbackUrl,
    successUrl,
    userId: String(candidate._id || ""),
    expirationMinutes: Number.isFinite(expirationMinutes) ? expirationMinutes : 15,
    billDuration: billDurationSeconds,
    expirationTimestamp,
  };
  logger.info("Bakong KHQR payload generated", bakongPayload);

  const merchantInfo = new MerchantInfo(
    bakongAccountId,
    merchantName,
    merchantCity,
    merchantId,
    acquiringBank,
    {
      currency: khqrData.currency.usd,
      amount: amountValue,
      billNumber: transactionId,
      mobileNumber: mobileNumber || undefined,
      storeLabel,
      terminalLabel,
      merchantCategoryCode,
      expirationTimestamp,
    }
  );
  const khqrResponse = khqrGenerator.generateMerchant(merchantInfo);

  if (khqrResponse?.status?.code !== 0 || !khqrResponse?.data?.qr) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message:
            khqrResponse?.status?.message ||
            "Failed to generate Bakong KHQR payment payload.",
          provider: khqrResponse,
        },
      },
    };
  }

  const qrCode = String(khqrResponse.data.qr || "").trim();
  const qrImage = getRequiredEnv("BAKONG_KHQR_IMAGE");
  logger.info("Bakong KHQR qrcode generated", { qrCode, transactionId });

  return {
    checkout: {
      mode: "qr",
      statusCode: "READY",
      message: "Bakong KHQR is ready",
      providerTransactionId: transactionId,
      qrCode,
      qrString: qrCode,
      qrImage,
      provider: "bakong_khqr",
      callbackUrl,
      successUrl,
      billDuration: billDurationSeconds,
    },
    providerPayload: {
      qrCode,
      qrString: qrCode,
      qrImage,
      md5: khqrResponse?.data?.md5 || "",
      payload: bakongPayload,
      userId: String(candidate._id || ""),
      callbackUrl,
      successUrl,
      billDuration: billDurationSeconds,
      expirationTimestamp,
      khqrResponse,
    },
  };
};

export const initiateAbaVerificationPayment = async (req, res) => {
  try {
    const merchantId = getRequiredEnv("ABA_PAYWAY_MERCHANT_ID");
    const apiKey = getRequiredEnv("ABA_PAYWAY_API_KEY");
    const purchaseApiUrl = getPurchaseApiUrl();
    const appOrigin = normalizeOriginUrl(getPrimaryAppOrigin());

    if (!merchantId || !apiKey || !purchaseApiUrl || !appOrigin) {
      return res.status(500).json({
        success: false,
        message: "ABA PayWay purchase environment is not configured",
      });
    }

    const candidate = await User.findById(req.user.id).select(
      "name email phoneNumber trustScore verifiedBadges isVerified"
    );

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found" });
    }

    if (
      candidate.isVerified ||
      (Array.isArray(candidate.verifiedBadges) &&
        candidate.verifiedBadges.includes(VERIFIED_BADGE))
    ) {
      return res.status(400).json({
        success: false,
        message: "Candidate is already verified",
      });
    }

    const reqTime = buildReqTime();
    const tranId = buildAbaTransactionId(candidate._id);
    const amountValue = FIXED_VERIFICATION_AMOUNT;
    const continueSuccessUrl = buildFrontendReturnUrl(appOrigin, tranId);
    const normalizedName = normalizePaywayField(candidate.name).trim();
    const [rawFirstName = "", ...restNames] = normalizedName
      ? normalizedName.split(/\s+/)
      : [];
    const firstname = normalizePaywayField(rawFirstName).trim();
    const lastname = normalizePaywayField(restNames.join(" ")).trim();
    const itemsJson = JSON.stringify([
      {
        name: "Candidate Verification",
        quantity: 1,
        price: amountValue,
      },
    ]);
    const itemsBase64 = Buffer.from(itemsJson, "utf8").toString("base64");
    logger.debug("ABA purchase items encoded", { itemsBase64 });

    const payment = await VerificationPayment.findOneAndUpdate(
      { candidateId: candidate._id, transactionId: tranId },
      {
        $set: {
          amount: Number(FIXED_VERIFICATION_AMOUNT),
          currency: "USD",
          status: PAYMENT_STATUS.PENDING,
          provider: "aba_payway",
          checkoutUrl: purchaseApiUrl,
          metadata: {
            reqTime,
            merchantId,
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const payload = {
      req_time: reqTime,
      merchant_id: merchantId,
      tran_id: tranId,
      amount: amountValue,
      items: itemsBase64,
      firstname,
      lastname,
      email: normalizePaywayField(candidate.email).trim(),
      phone: normalizePaywayField(candidate.phoneNumber).trim(),
      type: "purchase",
      payment_option: "abapay",
      continue_success_url: continueSuccessUrl,
      currency: "USD",
    };

    payload.hash = buildPurchaseHash({
      payload,
      apiKey,
    });
    logger.info("ABA purchase body prepared", {
      payload: { ...payload, hash: "[REDACTED]" },
    });

    const abaResponse = await fetch(purchaseApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const abaResponseText = await abaResponse.text();
    let abaData = {};
    try {
      abaData = abaResponseText ? JSON.parse(abaResponseText) : {};
    } catch {
      abaData = { raw: abaResponseText };
    }

    const statusCode = String(
      abaData?.status?.code ?? abaData?.status?.status ?? ""
    ).trim();
    const qrString = String(abaData?.qrString || "").trim();
    const qrImage = String(abaData?.qrImage || "").trim();
    const providerTranId = String(
      abaData?.tran_id || abaData?.status?.tran_id || ""
    ).trim();

    if (!abaResponse.ok || statusCode !== "00") {
      logger.warn("ABA purchase returned error response", { provider: abaData });
      return res.status(400).json({
        success: false,
        message:
          abaData?.status?.message ||
          abaData?.description ||
          "ABA PayWay purchase request failed",
        provider: abaData,
      });
    }

    if (!qrString && !qrImage) {
      logger.warn("ABA purchase missing QR data", { provider: abaData });
      return res.status(400).json({
        success: false,
        message: "ABA payment succeeded but did not return QR payment data",
        provider: abaData,
      });
    }

    payment.metadata = {
      ...(payment.metadata || {}),
      purchasePayload: {
        ...payload,
        hash: undefined,
      },
      purchaseResponse: abaData,
    };
    payment.providerTransactionId = providerTranId || tranId;

    await payment.save();

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      transactionId: tranId,
      tran_id: providerTranId || tranId,
      checkout: {
        mode: "qr",
        provider: "aba_payway",
        providerTransactionId: providerTranId || tranId,
        tran_id: providerTranId || tranId,
        qrString,
        qrImage,
        raw: abaData,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to initiate ABA payment: ${error.message}`,
    });
  }
};

export const initiateBakongVerificationPayment = async (req, res) => {
  try {
    const candidateResult = await loadCandidateForVerification(req.user.id);
    if (candidateResult.error) {
      return res
        .status(candidateResult.error.status)
        .json(candidateResult.error.body);
    }

    const { candidate } = candidateResult;
    const transactionId = buildBakongTransactionId(candidate._id);

    const bakongResult = buildBakongCheckout({
      candidate,
      transactionId,
    });

    if (bakongResult.error) {
      return res
        .status(bakongResult.error.status)
        .json(bakongResult.error.body);
    }

    const payment = await upsertVerificationPayment({
      candidateId: candidate._id,
      transactionId,
      provider: "bakong_khqr",
      checkoutUrl: "bakong://khqr",
      metadata: {
        provider: "bakong_khqr",
        userId: String(candidate._id || ""),
        qrResponse: bakongResult.providerPayload,
      },
    });

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      transactionId,
      checkout: bakongResult.checkout,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to initiate Bakong payment: ${error.message}`,
    });
  }
};

export const initiateVerificationPayment = async (req, res) => {
  const requestedProvider = String(
    req.body?.provider || req.query?.provider || "bakong_khqr"
  )
    .trim()
    .toLowerCase();

  if (requestedProvider === "bakong" || requestedProvider === "bakong_khqr") {
    return initiateBakongVerificationPayment(req, res);
  }

  return initiateAbaVerificationPayment(req, res);
};

export const finalizeVerificationPayment = async (req, res) => {
  try {
    const paymentRef = String(
      req.body?.paymentRef || req.query?.paymentRef || ""
    ).trim();

    const providerTransactionId = String(
      req.body?.tran_id ||
        req.query?.tran_id ||
        req.body?.transactionId ||
        req.query?.transactionId ||
        ""
    ).trim();

    if (!paymentRef && !providerTransactionId) {
      return res.status(400).json({
        success: false,
        message: "paymentRef or tran_id is required",
      });
    }

    const payment = await VerificationPayment.findOne({
      candidateId: req.user.id,
      $or: [
        ...(paymentRef ? [{ transactionId: paymentRef }] : []),
        ...(providerTransactionId
          ? [{ providerTransactionId: providerTransactionId }]
          : []),
      ],
    });

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    const candidate = await User.findById(payment.candidateId).select(
      "name trustScore verifiedBadges isVerified"
    );

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found" });
    }

    if (isBakongProvider(payment.provider)) {
      if (payment.status !== PAYMENT_STATUS.PAID) {
        return res.status(400).json({
          success: false,
          message: "Bakong payment is still pending callback confirmation",
          status: mapPaymentStatusLabel(payment.status),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Candidate verification completed",
        paymentId: payment._id,
        status: mapPaymentStatusLabel(payment.status),
        trustScore: Number(candidate.trustScore || 0),
        verifiedBadges: candidate.verifiedBadges || [],
        rank: getTrustMeta(candidate.trustScore).level,
      });
    }

    const resolution = await resolveVerificationPayment({
      payment,
      candidate,
      providerTransactionId,
      providerPayload: {
        source: "finalize_endpoint",
      },
      forceProviderCheck: true,
    });

    if (!resolution.ok) {
      return res.status(400).json({
        success: false,
        message: "Payment was not confirmed by ABA PayWay",
        status: mapPaymentStatusLabel(resolution.status),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Candidate verification completed",
      paymentId: payment._id,
      status: mapPaymentStatusLabel(resolution.status),
      trustScore: Number(resolution.candidate.trustScore || 0),
      verifiedBadges: resolution.candidate.verifiedBadges || [],
      rank: getTrustMeta(resolution.candidate.trustScore).level,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to finalize verification payment: ${error.message}`,
    });
  }
};

export const finalizeAbaVerificationPayment = finalizeVerificationPayment;

export const handleAbaVerificationCallback = async (req, res) => {
  try {
    const paymentRef = String(
      req.body?.paymentRef ||
        req.body?.return_params?.paymentRef ||
        req.query?.paymentRef ||
        ""
    ).trim();

    const providerTransactionId = String(
      req.body?.tran_id ||
        req.query?.tran_id ||
        req.body?.transactionId ||
        req.query?.transactionId ||
        ""
    ).trim();

    const payment = await findPaymentByReference(
      paymentRef,
      providerTransactionId
    );

    if (payment) {
      const candidate = await User.findById(payment.candidateId).select(
        "trustScore verifiedBadges isVerified"
      );

      if (candidate) {
        await resolveVerificationPayment({
          payment,
          candidate,
          providerTransactionId,
          providerPayload: {
            source: "callback",
            callbackBody: req.body || {},
            callbackQuery: req.query || {},
          },
          forceProviderCheck: true,
        });
      }
    }

    const appOrigin =
      normalizeOriginUrl(getPrimaryAppOrigin()) || "http://localhost:5173";

    const successUrl = new URL("/verification/success", `${appOrigin}/`);

    if (paymentRef) successUrl.searchParams.set("paymentRef", paymentRef);
    if (providerTransactionId) {
      successUrl.searchParams.set("tran_id", providerTransactionId);
    }
    successUrl.searchParams.set("provider", "aba_payway");

    return res.redirect(successUrl.toString());
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to process ABA callback: ${error.message}`,
    });
  }
};

export const handleBakongVerificationCallback = async (req, res) => {
  try {
    logger.info("Bakong callback endpoint hit but polling mode is active", {
      method: req.method,
      path: req.originalUrl,
    });
    return res.status(202).json({
      success: true,
      message: "Bakong callback received, but verification state is driven by active polling.",
    });
  } catch (error) {
    logger.error("Failed to process Bakong callback", {
      message: error.message,
    });
    return res.status(500).json({
      success: false,
      message: `Failed to process Bakong callback: ${error.message}`,
    });
  }
};

export const handleVerificationPaymentCallback = async (req, res) => {
  const providerHint = String(
    req.body?.provider ||
      req.query?.provider ||
      (req.body?.merchant_id || req.body?.tran_id ? "aba_payway" : "")
  )
    .trim()
    .toLowerCase();

  if (providerHint === "bakong" || providerHint === "bakong_khqr") {
    return handleBakongVerificationCallback(req, res);
  }

  return handleAbaVerificationCallback(req, res);
};

export const getVerificationPaymentStatus = async (req, res) => {
  try {
    const transactionRef = String(req.params?.tranId || "").trim();

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    const payment = await VerificationPayment.findOne({
      candidateId: req.user.id,
      $or: [
        { transactionId: transactionRef },
        { providerTransactionId: transactionRef },
      ],
    });

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    const candidate = await User.findById(payment.candidateId).select(
      "trustScore verifiedBadges isVerified"
    );

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found" });
    }

    const resolution = await resolveVerificationPayment({
      payment,
      candidate,
      providerTransactionId: payment.providerTransactionId,
      providerPayload: {
        source: "status_endpoint",
      },
      forceProviderCheck: true,
    });

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      transactionId: payment.transactionId,
      providerTransactionId: payment.providerTransactionId || "",
      status: mapPaymentStatusLabel(resolution.status),
      providerStatus: String(
        payment.metadata?.providerPayload?.bakongStatus ||
          payment.metadata?.providerPayload?.responseData?.responseMessage ||
          ""
      ).trim(),
      trustScore: Number(resolution.candidate.trustScore || 0),
      verifiedBadges: resolution.candidate.verifiedBadges || [],
      rank: getTrustMeta(resolution.candidate.trustScore).level,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load verification payment status: ${error.message}`,
    });
  }
};

export const getAbaVerificationPaymentStatus = getVerificationPaymentStatus;
