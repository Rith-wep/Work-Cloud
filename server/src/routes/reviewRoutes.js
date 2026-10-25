import { Router } from "express";

import { createCandidateReview } from "../controllers/applicationController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/candidate", protect, restrictTo("employer"), createCandidateReview);

export default router;
