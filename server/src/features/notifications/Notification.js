import mongoose from "mongoose";

const { Schema, model } = mongoose;

const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    senderName: { type: String, trim: true, default: "" },
    senderProfilePic: { type: String, trim: true, default: "" },
    message: { type: String, required: true, trim: true },
    messageKey: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: [
        "new_application",
        "job_alert",
        "job_accepted",
        "job_rejected",
        "job_interview_scheduled",
        "arrival_submitted",
        "arrival_confirmed",
        "no_show_reported",
        "system",
      ],
      default: "system",
    },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Notification = model("Notification", notificationSchema);

export default Notification;
