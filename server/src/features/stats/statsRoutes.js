import { Router } from "express";

import { getEmployerStats } from "./statsController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";

const router = Router();

router.get("/employer", protect, restrictTo("employer"), getEmployerStats);

export default router;
