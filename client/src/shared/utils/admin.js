export const ADMIN_ROLES = {
  MODERATOR: "moderator",
  SUPER_ADMIN: "super_admin",
};

export const hasAdminConsoleAccess = (user) =>
  Boolean(user?.isAdmin) &&
  [ADMIN_ROLES.MODERATOR, ADMIN_ROLES.SUPER_ADMIN].includes(String(user?.adminRole || "").toLowerCase());

export const isSuperAdmin = (user) =>
  String(user?.adminRole || "").toLowerCase() === ADMIN_ROLES.SUPER_ADMIN;
