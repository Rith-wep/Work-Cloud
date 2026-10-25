import { Router } from "express";

import {
  clearAllNotifications,
  deleteNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, getMyNotifications);
router.delete("/", protect, clearAllNotifications);
router.patch("/read-all", protect, markAllNotificationsRead);
router.delete("/:id", protect, deleteNotification);
router.patch("/:id/read", protect, markNotificationRead);

export default router;
