import jwt from "jsonwebtoken";

import User from "../../features/users/User.js";
import { ADMIN_ROLES, getAdminAccessPayload, hasAdminAccess } from "../utils/adminAccess.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: missing token" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id).select("-password");

    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    req.user = currentUser;
    const adminAccess = getAdminAccessPayload(currentUser);
    req.user.isAdmin = adminAccess.isAdmin;
    req.user.adminRole = adminAccess.adminRole;
    next();
  } catch (error) {
    return res.status(401).json({ message: `Unauthorized: ${error.message}` });
  }
};

export const restrictTo = (...roles) => (req, res, next) => {
  const userRole = req.user?.accountType || req.user?.role;

  if (!roles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: `Forbidden: ${userRole || "unknown"} role cannot access this route`,
      allowedRoles: roles,
    });
  }

  next();
};

export const requireAdmin = (req, res, next) => {
  if (!hasAdminAccess(req.user, ADMIN_ROLES.MODERATOR)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: admin access required",
    });
  }
  next();
};

export const requireAdminLevel = (minimumRole = ADMIN_ROLES.MODERATOR) => (req, res, next) => {
  if (!hasAdminAccess(req.user, minimumRole)) {
    return res.status(403).json({
      success: false,
      message: `Forbidden: ${minimumRole} access required`,
      requiredAdminRole: minimumRole,
      currentAdminRole: req.user?.adminRole || ADMIN_ROLES.NONE,
    });
  }

  next();
};
