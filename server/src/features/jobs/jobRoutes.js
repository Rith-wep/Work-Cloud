import { Router } from "express";

import {
  createJob,
  deleteJob,
  getJobById,
  getJobs,
  getMyJobs,
  getSavedJobs,
  toggleSaveJob,
  updateJob,
} from "./jobController.js";
import { protect, restrictTo } from "../../shared/middleware/authMiddleware.js";

const router = Router();

router.get("/", getJobs);
router.get("/my", protect, restrictTo("employer"), getMyJobs);
router.get("/saved", protect, getSavedJobs);
router.get("/:id", getJobById);
router.post("/", protect, restrictTo("employer"), createJob);
router.patch("/:id/save", protect, toggleSaveJob);
router.patch("/:id", protect, restrictTo("employer"), updateJob);
router.delete("/:id", protect, restrictTo("employer"), deleteJob);

export default router;
