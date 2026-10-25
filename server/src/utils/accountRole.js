export const normalizeAccountRole = (role) =>
  role === "employer" ? "employer" : "candidate";

export const getAccountRoleMismatch = (user, requestedRole) => {
  const expectedRole = normalizeAccountRole(requestedRole);
  const actualRole = normalizeAccountRole(user?.accountType || user?.role);

  if (actualRole === expectedRole) {
    return null;
  }

  const article = actualRole === "employer" ? "an" : "a";

  return {
    actualRole,
    expectedRole,
    message: `This account is registered as ${article} ${actualRole}. Please select ${actualRole} to sign in.`,
  };
};
