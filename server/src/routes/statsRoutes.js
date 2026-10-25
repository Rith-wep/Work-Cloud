import { Router } from "express";

import { getEmployerStats } from "../controllers/statsController.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/employer", protect, restrictTo("employer"), getEmployerStats);

export default router;
