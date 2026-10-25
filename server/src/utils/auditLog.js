import AuditLog from "../models/AuditLog.js";

const normalizeTargetIds = (targetIds = []) =>
  (Array.isArray(targetIds) ? targetIds : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 100);

export const recordAdminAuditLog = async ({
  req,
  action,
  resourceType,
  resourceId = "",
  targetIds = [],
  metadata = {},
}) => {
  if (!req?.user?._id || !req?.user?.isAdmin) {
    return null;
  }

  try {
    return await AuditLog.create({
      adminId: req.user._id,
      adminName: String(req.user.name || "").trim(),
      adminEmail: String(req.user.email || "").trim().toLowerCase(),
      adminRole: String(req.user.adminRole || "moderator").trim().toLowerCase(),
      action,
      resourceType,
      resourceId: String(resourceId || "").trim(),
      targetIds: normalizeTargetIds(targetIds),
      path: String(req.originalUrl || req.url || "").trim(),
      method: String(req.method || "").trim().toUpperCase(),
      origin: String(req.headers?.origin || "").trim(),
      ipAddress:
        String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() ||
        String(req.ip || "").trim(),
      userAgent: String(req.headers?.["user-agent"] || "").trim(),
      metadata,
    });
  } catch {
    return null;
  }
};
