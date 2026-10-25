import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import i18n from "../i18n.js";

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const SUPPORTED_LANGUAGES = ["en", "km", "zh"];
const DEFAULT_LANGUAGE = "en";
const SESSION_EXPIRED_EVENT = "auth:session-expired";

const normalizeLanguageCode = (lang) => {
  const next = String(lang || "").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(next) ? next : "";
};

const getPreferredLanguage = (userLanguage) => {
  const profileLanguage = normalizeLanguageCode(userLanguage);
  if (profileLanguage) {
    return profileLanguage;
  }
  const detectedLanguage = normalizeLanguageCode(localStorage.getItem("i18nextLng"));
  if (detectedLanguage) {
    return detectedLanguage;
  }
  const localLanguage = normalizeLanguageCode(localStorage.getItem("preferredLanguage"));
  if (localLanguage) {
    return localLanguage;
  }
  return DEFAULT_LANGUAGE;
};

const persistPreferredLanguage = (lang) => {
  const normalized = normalizeLanguageCode(lang);
  if (!normalized) return;
  localStorage.setItem("preferredLanguage", normalized);
  localStorage.setItem("i18nextLng", normalized);
};

const normalizeUser = (rawUser = {}) => ({
  id: rawUser._id || rawUser.id,
  name: rawUser.name,
  email: rawUser.email,
  role: rawUser.accountType || rawUser.role,
  isVerified: Boolean(rawUser.isVerified),
  trustScore: rawUser.trustScore ?? undefined,
  preferredLanguage: rawUser.preferredLanguage,
  verifiedBadges: Array.isArray(rawUser.verifiedBadges) ? rawUser.verifiedBadges : undefined,
  phoneNumber: rawUser.phoneNumber ?? undefined,
  telegramUsername: rawUser.telegramUsername ?? undefined,
  businessPhoneNumber: rawUser.businessPhoneNumber ?? undefined,
  businessTelegramUsername: rawUser.businessTelegramUsername ?? undefined,
  preferredContactMethod: rawUser.preferredContactMethod ?? undefined,
  bio: rawUser.bio ?? undefined,
  university: rawUser.university ?? undefined,
  school: rawUser.school ?? undefined,
  skills: Array.isArray(rawUser.skills) ? rawUser.skills : undefined,
  languages: Array.isArray(rawUser.languages) ? rawUser.languages : undefined,
  educationHistory: Array.isArray(rawUser.educationHistory) ? rawUser.educationHistory : undefined,
  workExperience: Array.isArray(rawUser.workExperience) ? rawUser.workExperience : undefined,
  preferredCategory: rawUser.preferredCategory ?? undefined,
  preferredCategories: Array.isArray(rawUser.preferredCategories)
    ? rawUser.preferredCategories
    : undefined,
  preferredLocation: rawUser.preferredLocation ?? undefined,
  isFirstLogin: Boolean(rawUser.isFirstLogin),
  companyName: rawUser.companyName ?? undefined,
  companyLogo: rawUser.companyLogo ?? undefined,
  companyCoverPicture: rawUser.companyCoverPicture ?? undefined,
  companyWebsite: rawUser.companyWebsite ?? undefined,
  companyAddress: rawUser.companyAddress ?? undefined,
  companySize: rawUser.companySize ?? undefined,
  companyLocation:
    rawUser.companyLocation && typeof rawUser.companyLocation === "object"
      ? {
          address: rawUser.companyLocation.address ?? "",
          lat:
            rawUser.companyLocation.lat !== undefined && rawUser.companyLocation.lat !== null
              ? Number(rawUser.companyLocation.lat)
              : null,
          lng:
            rawUser.companyLocation.lng !== undefined && rawUser.companyLocation.lng !== null
              ? Number(rawUser.companyLocation.lng)
              : null,
        }
      : undefined,
  businessRegistration: rawUser.businessRegistration ?? undefined,
  companyDescription: rawUser.companyDescription ?? undefined,
  verifiedApplicationsCount:
    rawUser.verifiedApplicationsCount !== undefined && rawUser.verifiedApplicationsCount !== null
      ? Number(rawUser.verifiedApplicationsCount || 0)
      : undefined,
  savedJobs: Array.isArray(rawUser.savedJobs) ? rawUser.savedJobs.map(String) : undefined,
  profilePicture: rawUser.profilePicture ?? undefined,
  isAdmin: Boolean(rawUser.isAdmin),
  adminRole: rawUser.adminRole ?? "none",
});

const mergeUserPreservingMedia = (previousUser, nextUser) => {
  const prev = previousUser || {};
  const next = nextUser || {};
  const merged = { ...prev };

  Object.entries(next).forEach(([key, value]) => {
    if (value !== undefined) {
      merged[key] = value;
    }
  });

  merged.profilePicture = merged.profilePicture || prev.profilePicture || "";
  merged.companyLogo = merged.companyLogo || prev.companyLogo || "";

  return merged;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const userRef = useRef(null);
  const sessionExpiredNotifiedRef = useRef(false);

  const persistSession = useCallback((nextToken, nextUser, rememberMe) => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");

    if (rememberMe) {
      localStorage.setItem("authToken", nextToken);
      localStorage.setItem("authUser", JSON.stringify(nextUser));
      return;
    }

    sessionStorage.setItem("authToken", nextToken);
    sessionStorage.setItem("authUser", JSON.stringify(nextUser));
  }, []);

  const persistUserProfileOnly = useCallback((nextUser) => {
    if (localStorage.getItem("authToken")) {
      localStorage.setItem("authUser", JSON.stringify(nextUser));
    }

    if (sessionStorage.getItem("authToken")) {
      sessionStorage.setItem("authUser", JSON.stringify(nextUser));
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const triggerSessionExpired = useCallback(() => {
    if (sessionExpiredNotifiedRef.current) {
      return;
    }
    sessionExpiredNotifiedRef.current = true;
    setToken("");
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }, []);

  const isJwtExpired401 = useCallback((status, message) => {
    return Number(status) === 401 && String(message || "").toLowerCase().includes("jwt expired");
  }, []);

  useEffect(() => {
    const storedToken =
      localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
    const storedUser =
      localStorage.getItem("authUser") || sessionStorage.getItem("authUser");

    if (storedToken && storedUser) {
      setToken(storedToken);
      const parsedUser = normalizeUser(JSON.parse(storedUser));
      setUser(parsedUser);
      const nextLanguage = getPreferredLanguage(parsedUser?.preferredLanguage);
      i18n.changeLanguage(nextLanguage);
      persistPreferredLanguage(nextLanguage);

      fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "Failed to refresh session user");
          }
          const refreshedUser = normalizeUser(data.user);
          setUser((prev) => mergeUserPreservingMedia(prev, refreshedUser));
          persistUserProfileOnly(mergeUserPreservingMedia(parsedUser, refreshedUser));
        })
        .catch(() => {});
    }

    setIsBootstrapping(false);
  }, [persistUserProfileOnly]);

  useEffect(() => {
    if (token && user) {
      sessionExpiredNotifiedRef.current = false;
    }
  }, [token, user]);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || error?.message;
        if (isJwtExpired401(status, message)) {
          triggerSessionExpired();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [isJwtExpired401, triggerSessionExpired]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response?.status === 401) {
        try {
          const body = await response.clone().json();
          if (isJwtExpired401(response.status, body?.message)) {
            triggerSessionExpired();
          }
        } catch {
          // no-op: non-json 401 responses are handled by callers
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isJwtExpired401, triggerSessionExpired]);

  const login = useCallback(async ({ email, password, rememberMe, role }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    const normalizedUser = normalizeUser(data.user);

    setToken(data.token);
    setUser(normalizedUser);
    persistSession(data.token, normalizedUser, rememberMe);
    const nextLanguage = getPreferredLanguage(normalizedUser.preferredLanguage);
    await i18n.changeLanguage(nextLanguage);
    persistPreferredLanguage(nextLanguage);
    if (nextLanguage !== normalizeLanguageCode(normalizedUser.preferredLanguage)) {
      fetch(`${API_BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ preferredLanguage: nextLanguage }),
      }).catch(() => {});
    }

    return normalizedUser;
  }, [persistSession]);

  const loginWithGoogle = useCallback(async ({ credential, rememberMe = true, role }) => {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, role }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Google login failed");
    }

    const normalizedUser = normalizeUser(data.user);

    setToken(data.token);
    setUser(normalizedUser);
    persistSession(data.token, normalizedUser, rememberMe);
    const nextLanguage = getPreferredLanguage(normalizedUser.preferredLanguage);
    await i18n.changeLanguage(nextLanguage);
    persistPreferredLanguage(nextLanguage);
    if (nextLanguage !== normalizeLanguageCode(normalizedUser.preferredLanguage)) {
      fetch(`${API_BASE_URL}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ preferredLanguage: nextLanguage }),
      }).catch(() => {});
    }

    return normalizedUser;
  }, [persistSession]);

  const register = useCallback(
    async ({ name, email, password, role, rememberMe }) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          const firstError = Object.values(data.errors)[0]?.[0];
          throw new Error(firstError || data.message || "Registration failed");
        }

        throw new Error(data.message || "Registration failed");
      }

      const normalizedUser = normalizeUser(data.user);

      setToken(data.token);
      setUser(normalizedUser);
      persistSession(data.token, normalizedUser, rememberMe);
      const nextLanguage = getPreferredLanguage(normalizedUser.preferredLanguage);
      await i18n.changeLanguage(nextLanguage);
      persistPreferredLanguage(nextLanguage);
      if (nextLanguage !== normalizeLanguageCode(normalizedUser.preferredLanguage)) {
        fetch(`${API_BASE_URL}/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({ preferredLanguage: nextLanguage }),
        }).catch(() => {});
      }

      return normalizedUser;
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    sessionExpiredNotifiedRef.current = false;
    setToken("");
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (isJwtExpired401(response.status, data?.message)) {
      triggerSessionExpired();
      return null;
    }
    if (!response.ok) {
      throw new Error(data.message || "Failed to load profile");
    }

    const normalizedUser = normalizeUser(data.user);
    const mergedUser = mergeUserPreservingMedia(userRef.current, normalizedUser);

    setUser(mergedUser);
    persistUserProfileOnly(mergedUser);
    return mergedUser;
  }, [isJwtExpired401, persistUserProfileOnly, token, triggerSessionExpired]);

  const changePreferredLanguage = useCallback(
    async (lang) => {
      const normalizedLang = normalizeLanguageCode(lang) || DEFAULT_LANGUAGE;
      await i18n.changeLanguage(normalizedLang);
      persistPreferredLanguage(normalizedLang);

      if (!token || !userRef.current) {
        return;
      }

      const optimisticUser = {
        ...userRef.current,
        preferredLanguage: normalizedLang,
      };
      setUser(optimisticUser);
      persistUserProfileOnly(optimisticUser);

      try {
        const response = await fetch(`${API_BASE_URL}/users/update-language`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredLanguage: normalizedLang }),
        });

        const data = await response.json();
        if (isJwtExpired401(response.status, data?.message)) {
          triggerSessionExpired();
          return;
        }
        if (!response.ok) {
          return;
        }

        const normalizedUser = normalizeUser(data.user);
        const mergedUser = mergeUserPreservingMedia(userRef.current, normalizedUser);
        setUser(mergedUser);
        persistUserProfileOnly(mergedUser);
      } catch {
        // silent background sync: keep UI language and local user state as-is
      }
    },
    [isJwtExpired401, persistUserProfileOnly, token, triggerSessionExpired]
  );

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isBootstrapping,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshCurrentUser,
      setUser,
      changePreferredLanguage,
    }),
    [
      isAuthenticated,
      isBootstrapping,
      login,
      loginWithGoogle,
      logout,
      refreshCurrentUser,
      register,
      changePreferredLanguage,
      token,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
