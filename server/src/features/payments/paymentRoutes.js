import { Router } from "express";

import {
  finalizeVerificationPayment,
  getVerificationPaymentStatus,
  handleAbaVerificationCallback,
  handleBakongVerificationCallback,
  handleVerificationPaymentCallback,
  initiateBakongVerificationPayment,
  initiateAbaVerificationPayment,
  initiateVerificationPayment,
} from "./paymentController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";

const router = Router();

router.get("/callback", handleVerificationPaymentCallback);
router.post("/callback", handleVerificationPaymentCallback);
router.get("/verification/aba/callback", handleAbaVerificationCallback);
router.post("/verification/aba/callback", handleAbaVerificationCallback);
router.get("/verification/bakong/callback", handleBakongVerificationCallback);
router.post("/verification/bakong/callback", handleBakongVerificationCallback);
router.post(
  "/verification/initiate",
  protect,
  restrictTo("candidate"),
  initiateVerificationPayment
);
router.post(
  "/verification/aba/initiate",
  protect,
  restrictTo("candidate"),
  initiateAbaVerificationPayment
);
router.post(
  "/verification/bakong/initiate",
  protect,
  restrictTo("candidate"),
  initiateBakongVerificationPayment
);
router.post(
  "/verification/aba/finalize",
  protect,
  restrictTo("candidate"),
  finalizeVerificationPayment
);
router.post(
  "/verification/finalize",
  protect,
  restrictTo("candidate"),
  finalizeVerificationPayment
);
router.get(
  "/status/:tranId",
  protect,
  restrictTo("candidate"),
  getVerificationPaymentStatus
);

export default router;
