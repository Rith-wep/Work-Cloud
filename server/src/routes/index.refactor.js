import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import authRoutes from "./authRoutes.js";
import jobRoutes from "./jobRoutes.js";
import applicationRoutes from "./applicationRoutes.js";
import adminRoutes from "./adminRoutes.js";
import usersRoutes from "./usersRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import statsRoutes from "./statsRoutes.js";
import reviewRoutes from "./reviewRoutes.js";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/jobs", jobRoutes);
router.use("/applications", applicationRoutes);
router.use("/admin", adminRoutes);
router.use("/users", usersRoutes);
router.use("/notifications", notificationRoutes);
router.use("/payments", paymentRoutes);
router.use("/stats", statsRoutes);
router.use("/reviews", reviewRoutes);

export default router;
