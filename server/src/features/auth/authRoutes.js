import { Router } from "express";

import {
  getCatalogOptions,
  googleLogin,
  login,
  register,
  updateProfile,
} from "./authController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);

router.get("/me", protect, (req, res) => {
  const user = req.user?.toObject ? req.user.toObject() : { ...req.user };
  res.status(200).json({
    success: true,
    user: {
      ...user,
      isAdmin: Boolean(req.user?.isAdmin),
      adminRole: req.user?.adminRole || "none",
    },
  });
});
router.get("/catalog", protect, getCatalogOptions);
router.patch("/me", protect, updateProfile);

router.get("/employer-only", protect, restrictTo("employer"), (_req, res) => {
  res.status(200).json({ message: "Employer access granted" });
});

export default router;
