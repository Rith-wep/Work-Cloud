export const ADMIN_ROLES = {
  NONE: "none",
  MODERATOR: "moderator",
  SUPER_ADMIN: "super_admin",
};

const ADMIN_ROLE_PRIORITY = {
  [ADMIN_ROLES.NONE]: 0,
  [ADMIN_ROLES.MODERATOR]: 1,
  [ADMIN_ROLES.SUPER_ADMIN]: 2,
};

const normalizeAdminRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === ADMIN_ROLES.SUPER_ADMIN) {
    return ADMIN_ROLES.SUPER_ADMIN;
  }

  if (normalized === ADMIN_ROLES.MODERATOR) {
    return ADMIN_ROLES.MODERATOR;
  }

  return ADMIN_ROLES.NONE;
};

const parseEmailList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const getConfiguredAdminEmails = () => ({
  superAdmins: parseEmailList(process.env.SUPER_ADMIN_EMAILS || process.env.ADMIN_EMAILS),
  moderators: parseEmailList(process.env.MODERATOR_EMAILS),
});

export const getEnvAdminRole = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return ADMIN_ROLES.NONE;
  }

  const { superAdmins, moderators } = getConfiguredAdminEmails();

  if (superAdmins.includes(normalizedEmail)) {
    return ADMIN_ROLES.SUPER_ADMIN;
  }

  if (moderators.includes(normalizedEmail)) {
    return ADMIN_ROLES.MODERATOR;
  }

  return ADMIN_ROLES.NONE;
};

export const resolveAdminRole = (user) => {
  const storedRole = normalizeAdminRole(user?.adminRole);
  const envRole = getEnvAdminRole(user?.email);

  return ADMIN_ROLE_PRIORITY[storedRole] >= ADMIN_ROLE_PRIORITY[envRole] ? storedRole : envRole;
};

export const hasAdminAccess = (user, minimumRole = ADMIN_ROLES.MODERATOR) => {
  const resolvedRole = resolveAdminRole(user);
  return ADMIN_ROLE_PRIORITY[resolvedRole] >= ADMIN_ROLE_PRIORITY[normalizeAdminRole(minimumRole)];
};

export const getAdminAccessPayload = (user) => {
  const adminRole = resolveAdminRole(user);
  return {
    isAdmin: adminRole !== ADMIN_ROLES.NONE,
    adminRole,
  };
};
