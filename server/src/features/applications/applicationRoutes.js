import { Router } from "express";

import {
  completeHandshake,
  confirmCandidateArrival,
  createApplication,
  getApplicationCvSnapshot,
  getCandidateReviews,
  getCandidateApplications,
  getEmployerApplicantsByJob,
  getEmployerApplications,
  getMyApplications,
  reportNoShow,
  updateApplicationInterviewDetails,
  updateApplicationStatus,
} from "./applicationController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";

const router = Router();

router.get("/my", protect, restrictTo("candidate"), getMyApplications);
router.get("/candidate", protect, restrictTo("candidate"), getCandidateApplications);
router.get("/employer", protect, restrictTo("employer"), getEmployerApplications);
router.get("/employer/job/:jobId/applicants", protect, restrictTo("employer"), getEmployerApplicantsByJob);
router.get("/:id/cv-snapshot", protect, getApplicationCvSnapshot);
router.get(
  "/candidate/:candidateId/reviews",
  protect,
  restrictTo("employer"),
  getCandidateReviews
);
router.post("/", protect, restrictTo("candidate"), createApplication);
router.patch("/:id/interview", protect, restrictTo("employer"), updateApplicationInterviewDetails);
router.patch("/:id/status", protect, restrictTo("employer"), updateApplicationStatus);
router.patch("/:id/confirm-arrival", protect, restrictTo("employer"), confirmCandidateArrival);
router.patch("/:id/report-no-show", protect, restrictTo("employer"), reportNoShow);
router.patch("/:id/handshake", protect, restrictTo("candidate"), completeHandshake);

export default router;
