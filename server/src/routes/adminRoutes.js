import { Router } from "express";

import {
  getAdminStats,
  getAllJobs,
  getAllUsers,
  getAuditLogs,
  getCatalogAiMergeSuggestions,
  getCatalogDashboard,
  mergeCatalogDashboardTerms,
} from "../controllers/adminController.js";
import { protect, requireAdminLevel } from "../middleware/authMiddleware.js";
import { ADMIN_ROLES } from "../utils/adminAccess.js";

const router = Router();

router.use(protect, requireAdminLevel(ADMIN_ROLES.MODERATOR));

router.get("/catalog", getCatalogDashboard);
router.get("/catalog/ai-suggestions", getCatalogAiMergeSuggestions);
router.post("/catalog/merge", requireAdminLevel(ADMIN_ROLES.SUPER_ADMIN), mergeCatalogDashboardTerms);

router.get("/all-users", requireAdminLevel(ADMIN_ROLES.SUPER_ADMIN), getAllUsers);
router.get("/all-jobs", requireAdminLevel(ADMIN_ROLES.SUPER_ADMIN), getAllJobs);
router.get("/stats", requireAdminLevel(ADMIN_ROLES.SUPER_ADMIN), getAdminStats);
router.get("/audit-logs", requireAdminLevel(ADMIN_ROLES.SUPER_ADMIN), getAuditLogs);

export default router;
