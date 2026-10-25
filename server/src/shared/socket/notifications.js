import Notification from "../../features/notifications/Notification.js";
import Job from "../../features/jobs/Job.js";
import { getSocketIO } from "./socketServer.js";

export const createAndEmitNotification = async ({
  recipientId,
  senderId = null,
  senderName = "",
  senderProfilePic = "",
  message,
  messageKey = "",
  type = "system",
  metadata = {},
  persist = true,
  existingNotification = null,
}) => {
  if (!recipientId && !existingNotification) {
    return null;
  }

  const baseMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};
  let jobSnapshot = null;

  if (baseMetadata.jobId && (!baseMetadata.jobTitle || !baseMetadata.companyName)) {
    jobSnapshot = await Job.findById(baseMetadata.jobId).select(
      "title companyProfile companyId employerId"
    );
  }

  const enrichedMetadata = {
    ...baseMetadata,
    jobTitle:
      String(baseMetadata.jobTitle || "").trim() ||
      String(jobSnapshot?.title || "").trim(),
    companyName:
      String(baseMetadata.companyName || "").trim() ||
      String(senderName || "").trim() ||
      String(jobSnapshot?.companyProfile?.companyName || "").trim(),
    interviewLink:
      String(baseMetadata.interviewLink || "").trim() ||
      String(baseMetadata.meetingLink || "").trim(),
  };

  const normalizedMessageKey =
    String(messageKey || "").trim() ||
    (type !== "system" ? `notifications.types.${type}` : "");

  let populatedNotification = null;
  let notification = existingNotification;

  if (persist) {
    notification = await Notification.create({
      recipientId,
      senderId,
      senderName,
      senderProfilePic,
      message,
      messageKey: normalizedMessageKey,
      type,
      isRead: false,
      metadata: enrichedMetadata,
    });

    populatedNotification = await Notification.findById(notification._id).populate(
      "senderId",
      "name profilePicture"
    );
  } else {
    notification = {
      ...(existingNotification && typeof existingNotification.toObject === "function"
        ? existingNotification.toObject()
        : existingNotification || {}),
      recipientId,
      senderId,
      senderName,
      senderProfilePic,
      message,
      messageKey: normalizedMessageKey,
      type,
      isRead: false,
      metadata: enrichedMetadata,
      createdAt:
        existingNotification?.createdAt || new Date(),
      updatedAt:
        existingNotification?.updatedAt || new Date(),
    };
  }

  const io = getSocketIO();
  if (io) {
    io.to(`user:${String(recipientId)}`).emit(
      "new_notification",
      populatedNotification
        ? populatedNotification.toObject()
        : typeof notification?.toObject === "function"
          ? notification.toObject()
          : notification
    );
  }

  return populatedNotification || notification;
};
