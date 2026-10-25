import Notification from "../models/Notification.js";

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user.id })
      .populate("senderId", "name profilePicture")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch notifications: ${error.message}`,
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: req.user.id },
      { $set: { isRead: true } },
      { new: true }
    ).populate("senderId", "name profilePicture");

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update notification: ${error.message}`,
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update notifications: ${error.message}`,
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipientId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted",
      id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to delete notification: ${error.message}`,
    });
  }
};

export const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipientId: req.user.id });

    return res.status(200).json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to clear notifications: ${error.message}`,
    });
  }
};
