import { Router } from "express";

import {
  getPublicCandidateProfileForEmployer,
  getPublicEmployerProfile,
  updateCompanyCoverPicture,
  updateLanguagePreference,
  updateEmployerProfileWithLogo,
  updateProfilePicture,
  updateUserProfile,
} from "./userController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";
import {
  uploadCompanyCoverPicture,
  uploadCompanyLogo,
  uploadProfilePicture,
} from "../../shared/middleware/uploadMiddleware.js";

const router = Router();

router.get("/employer/:id", getPublicEmployerProfile);
router.get(
  "/candidate/:id/public",
  protect,
  restrictTo("employer"),
  getPublicCandidateProfileForEmployer
);

router.patch("/profile", protect, updateUserProfile);
router.patch("/update-language", protect, updateLanguagePreference);
router.post("/cover-picture", protect, restrictTo("employer"), (req, res, next) => {
  uploadCompanyCoverPicture(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed",
      });
    }
    return next();
  });
}, updateCompanyCoverPicture);
router.post("/employer/profile", protect, restrictTo("employer"), (req, res, next) => {
  uploadCompanyLogo(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed",
      });
    }
    return next();
  });
}, updateEmployerProfileWithLogo);

router.patch("/profile-picture", protect, restrictTo("candidate"), (req, res, next) => {
  uploadProfilePicture(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed",
      });
    }
    return next();
  });
}, updateProfilePicture);

export default router;
