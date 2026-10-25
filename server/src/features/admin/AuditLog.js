import mongoose from "mongoose";

const { Schema, model } = mongoose;

const auditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: false, default: null, index: true },
    adminName: { type: String, trim: true, default: "" },
    adminEmail: { type: String, trim: true, required: true, index: true },
    adminRole: {
      type: String,
      enum: ["moderator", "super_admin", "system"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["view", "edit", "delete", "export", "create"],
      required: true,
      index: true,
    },
    resourceType: { type: String, trim: true, required: true, index: true },
    resourceId: { type: String, trim: true, default: "" },
    targetIds: [{ type: String, trim: true }],
    path: { type: String, trim: true, required: true },
    method: { type: String, trim: true, required: true },
    origin: { type: String, trim: true, default: "" },
    ipAddress: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1, adminId: 1 });

const AuditLog = model("AuditLog", auditLogSchema);

export default AuditLog;
