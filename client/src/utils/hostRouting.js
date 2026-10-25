const DEFAULT_MAIN_ORIGIN = "https://workcloud.com";
const DEFAULT_ADMIN_ORIGIN = "https://admin.workcloud.com";

const normalizeOrigin = (value, fallback) => {
  const raw = String(value || "").trim();
  return raw || fallback;
};

export const getMainAppOrigin = () =>
  normalizeOrigin(import.meta.env.VITE_MAIN_APP_ORIGIN, DEFAULT_MAIN_ORIGIN);

export const getAdminAppOrigin = () =>
  normalizeOrigin(import.meta.env.VITE_ADMIN_APP_ORIGIN, DEFAULT_ADMIN_ORIGIN);

export const isLocalHost = (hostname = window.location.hostname) =>
  /^(localhost|127\.0\.0\.1)$/i.test(String(hostname || "").trim());

export const isAdminHostname = (hostname = window.location.hostname) => {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  if (!normalizedHostname) {
    return false;
  }

  const adminOriginHostname = (() => {
    try {
      return new URL(getAdminAppOrigin()).hostname.toLowerCase();
    } catch {
      return "admin.workcloud.com";
    }
  })();

  return normalizedHostname === adminOriginHostname || normalizedHostname === "admin.workcloud.com";
};

const buildRedirectUrl = (targetOrigin, pathname = "/", search = "", hash = "") => {
  const base = String(targetOrigin || "").replace(/\/+$/, "");
  const nextPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${nextPath}${search || ""}${hash || ""}`;
};

export const getAdminConsoleUrl = (pathname = "/") => {
  const targetOrigin = getAdminAppOrigin();
  const nextPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (typeof window !== "undefined" && isLocalHost()) {
    const normalizedBase = String(targetOrigin || "").replace(/\/+$/, "");
    const entryBase = normalizedBase.endsWith("/admin.html") ? normalizedBase : `${normalizedBase}/admin.html`;
    return `${entryBase}#${nextPath}`;
  }

  return buildRedirectUrl(targetOrigin, nextPath);
};

export const getMainAppUrl = (pathname = "/") => buildRedirectUrl(getMainAppOrigin(), pathname);

export const redirectMainEntryIfNeeded = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (isLocalHost() || !isAdminHostname()) {
    return false;
  }

  window.location.replace(
    buildRedirectUrl(getAdminAppOrigin(), window.location.pathname, window.location.search, window.location.hash)
  );
  return true;
};

export const redirectAdminEntryIfNeeded = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (isLocalHost() || isAdminHostname()) {
    return false;
  }

  window.location.replace(
    buildRedirectUrl(getMainAppOrigin(), window.location.pathname, window.location.search, window.location.hash)
  );
  return true;
};
