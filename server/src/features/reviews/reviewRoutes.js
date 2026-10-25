import { Router } from "express";

import { createCandidateReview } from "../applications/applicationController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";

const router = Router();

router.post("/candidate", protect, restrictTo("employer"), createCandidateReview);

export default router;

