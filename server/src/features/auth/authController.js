import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

import CatalogTerm from "../users/CatalogTerm.js";
import User from "../users/User.js";
import {
  applyCandidateProfileBonusIfEligible,
  applyEmployerLocationBonusIfEligible,
} from "../../shared/utils/profileBonus.js";
import { getAdminAccessPayload } from "../../shared/utils/adminAccess.js";
import { getAccountRoleMismatch, normalizeAccountRole } from "../../shared/utils/accountRole.js";
import { toSkillKey } from "../../shared/utils/skills.js";
import { signToken } from "../../shared/utils/token.js";
import { registerSchema } from "../../shared/utils/validation.js";

const serializeAuthUser = (user, overrides = {}) => {
  const adminAccess = getAdminAccessPayload(user);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.accountType || user.role,
    isVerified: Boolean(user.isVerified),
    trustScore: user.trustScore,
    preferredLanguage: user.preferredLanguage,
    verifiedBadges: user.verifiedBadges,
    phoneNumber: user.phoneNumber || "",
    telegramUsername: user.telegramUsername || "",
    businessPhoneNumber: user.businessPhoneNumber || "",
    businessTelegramUsername: user.businessTelegramUsername || "",
    preferredContactMethod: user.preferredContactMethod || "none",
    bio: user.bio || "",
    university: user.university || "",
    school: user.school || "",
    skills: Array.isArray(user.skills) ? user.skills : [],
    languages: Array.isArray(user.languages) ? user.languages : [],
    educationHistory: Array.isArray(user.educationHistory) ? user.educationHistory : [],
    workExperience: Array.isArray(user.workExperience) ? user.workExperience : [],
    preferredCategory: user.preferredCategory || "",
    preferredCategories: Array.isArray(user.preferredCategories) ? user.preferredCategories : [],
    preferredLocation: user.preferredLocation || "",
    isFirstLogin: Boolean(user.isFirstLogin),
    companyName: user.companyName || "",
    companyLogo: user.companyLogo || "",
    companyCoverPicture: user.companyCoverPicture || "",
    companyWebsite: user.companyWebsite || "",
    companyAddress: user.companyAddress || user.companyLocation?.address || "",
    companySize: user.companySize || "",
    companyLocation: {
      address: user.companyLocation?.address || "",
      lat: user.companyLocation?.lat ?? null,
      lng: user.companyLocation?.lng ?? null,
    },
    businessRegistration: user.businessRegistration || "",
    companyDescription: user.companyDescription || "",
    savedJobs: (user.savedJobs || []).map((jobId) => String(jobId)),
    profilePicture: user.profilePicture || "",
    isAdmin: adminAccess.isAdmin,
    adminRole: adminAccess.adminRole,
    ...overrides,
  };
};

const buildAuthResponse = (user, message) => ({
  success: true,
  message,
  token: signToken(user._id),
  user: serializeAuthUser(user),
});

const sanitizePreferredContactMethod = (value) => {
  const method = String(value || "none").toLowerCase();
  if (["phone", "telegram", "none"].includes(method)) {
    return method;
  }
  return null;
};

const normalizeCloudinarySecureUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/^http:\/\/res\.cloudinary\.com\//i, "https://res.cloudinary.com/");
};

const parseCompanyLocation = (value) => {
  if (value === undefined) {
    return { provided: false, data: null, error: "" };
  }

  const address = String(value?.address || "").trim();
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);

  if (!address && (value?.lat === undefined || value?.lng === undefined)) {
    return { provided: true, data: { address: "", lat: null, lng: null }, error: "" };
  }

  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      provided: true,
      data: null,
      error: "companyLocation must include address, lat, and lng",
    };
  }

  return {
    provided: true,
    data: {
      address,
      lat,
      lng,
      geo: {
        type: "Point",
        coordinates: [lng, lat],
      },
    },
    error: "",
  };
};

const toCatalogLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ")
    .trim();

const syncCatalogTerms = async ({ kind, values, userId }) => {
  const normalizedValues = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((entry) => toSkillKey(String(entry || "").trim()))
        .filter(Boolean)
    )
  );

  if (!normalizedValues.length) {
    return;
  }

  await CatalogTerm.bulkWrite(
    normalizedValues.map((value) => ({
      updateOne: {
        filter: { kind, key: value },
        update: {
          $setOnInsert: {
            kind,
            key: value,
            label: toCatalogLabel(value),
            createdBy: userId || null,
          },
          $inc: { usageCount: 1 },
        },
        upsert: true,
      },
    }))
  );
};

export const getCatalogOptions = async (_req, res) => {
  try {
    const [skills, categories] = await Promise.all([
      CatalogTerm.find({ kind: "skill" }).sort({ usageCount: -1, label: 1 }).select("key label").lean(),
      CatalogTerm.find({ kind: "category" }).sort({ usageCount: -1, label: 1 }).select("key label").lean(),
    ]);

    return res.status(200).json({
      success: true,
      skills: skills.map((item) => ({
        key: item.key,
        label: item.label || toCatalogLabel(item.key),
      })),
      categories: categories.map((item) => ({
        key: item.key,
        label: item.label || toCatalogLabel(item.key),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load catalog options: ${error.message}`,
    });
  }
};

export const register = async (req, res) => {
  try {
    const parsedBody = registerSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    const { name, email, password, role } = parsedBody.data;

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      accountType: role,
      trustScore: 0,
      verifiedBadges: [],
    });

    return res.status(201).json(buildAuthResponse(user, "Registration successful"));
  } catch (error) {
    if (error.message === "JWT_SECRET is missing in .env") {
      console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
      return res
        .status(500)
        .json({
          success: false,
          message: "Server configuration error: Missing Secret Key",
        });
    }

    return res.status(500).json({ success: false, message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || "");

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const roleMismatch = getAccountRoleMismatch(user, role);
    if (roleMismatch) {
      return res.status(403).json({
        message: roleMismatch.message,
      });
    }

    return res.status(200).json(buildAuthResponse(user, "Login successful"));
  } catch (error) {
    if (error.message === "JWT_SECRET is missing in .env") {
      console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
      return res
        .status(500)
        .json({
          success: false,
          message: "Server configuration error: Missing Secret Key",
        });
    }

    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    const credential = String(req.body?.credential || "").trim();
    const requestedRole = normalizeAccountRole(req.body?.role);

    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential is required" });
    }

    if (!googleClientId) {
      return res.status(500).json({
        success: false,
        message: "Server configuration error: Missing GOOGLE_CLIENT_ID",
      });
    }
    const googleOAuthClient = new OAuth2Client(googleClientId);

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();
    if (!email || !payload?.email_verified) {
      return res.status(401).json({ success: false, message: "Google account is not verified" });
    }

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const fallbackName = email.split("@")[0] || "WorkCloud User";
      const placeholderPassword = await bcrypt.hash(`google:${payload.sub}:${Date.now()}`, 10);

      user = await User.create({
        name: String(payload?.name || fallbackName).trim(),
        email,
        password: placeholderPassword,
        role: requestedRole,
        accountType: requestedRole,
        trustScore: 0,
        isVerified: false,
        verifiedBadges: [],
      });
    }

    const roleMismatch = getAccountRoleMismatch(user, requestedRole);
    if (roleMismatch) {
      return res.status(403).json({
        success: false,
        message: roleMismatch.message,
      });
    }

    return res.status(200).json(
      buildAuthResponse(
        user,
        isNewUser ? "Google account registered and login successful" : "Google login successful"
      )
    );
  } catch (error) {
    return res.status(401).json({ success: false, message: "Google login failed" });
  }
};

export const updateProfile = async (req, res) => {
  try {
  const {
    phoneNumber,
    telegramUsername,
    preferredContactMethod,
    preferredLanguage,
    bio,
    university,
    school,
    skills,
    languages,
    educationHistory,
    workExperience,
    preferredCategory,
    preferredCategories,
    preferredLocation,
    isFirstLogin,
    profilePicture,
    companyName,
    companyLogo,
    companyCoverPicture,
    companyWebsite,
    companyAddress,
    companySize,
    companyLocation,
      businessRegistration,
      companyDescription,
      businessPhoneNumber,
      businessTelegramUsername,
    } = req.body;

    const updates = {};

    const role = req.user.accountType || req.user.role;

    if (role === "candidate") {
      if (phoneNumber !== undefined) {
        updates.phoneNumber = String(phoneNumber || "").trim();
      }

      if (telegramUsername !== undefined) {
        updates.telegramUsername = String(telegramUsername || "")
          .trim()
          .replace(/^@/, "");
      }

      if (bio !== undefined) {
        const normalizedBio = String(bio || "").trim();
        if (normalizedBio.length > 200) {
          return res.status(400).json({
            success: false,
            message: "Bio must be 200 characters or fewer",
          });
        }
        updates.bio = normalizedBio;
      }

      if (university !== undefined) {
        updates.university = String(university || "").trim().slice(0, 120);
      }

      if (school !== undefined) {
        updates.school = String(school || "").trim().slice(0, 120);
      }

      if (skills !== undefined) {
        if (!Array.isArray(skills)) {
          return res.status(400).json({
            success: false,
            message: "skills must be an array",
          });
        }
        updates.skills = skills
          .map((entry) => toSkillKey(String(entry || "").trim().slice(0, 80)))
          .filter(Boolean);
      }

      if (languages !== undefined) {
        if (!Array.isArray(languages)) {
          return res.status(400).json({
            success: false,
            message: "languages must be an array",
          });
        }
        updates.languages = languages
          .map((entry) => String(entry || "").trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 12);
      }

      if (educationHistory !== undefined) {
        if (!Array.isArray(educationHistory)) {
          return res.status(400).json({
            success: false,
            message: "educationHistory must be an array",
          });
        }
        updates.educationHistory = educationHistory
          .map((entry) => String(entry || "").trim().slice(0, 140))
          .filter(Boolean)
          .slice(0, 20);
      }

      if (workExperience !== undefined) {
        if (!Array.isArray(workExperience)) {
          return res.status(400).json({
            success: false,
            message: "workExperience must be an array",
          });
        }
        updates.workExperience = workExperience
          .map((entry) => ({
            jobTitle: String(entry?.jobTitle || "").trim().slice(0, 120),
            bulletPoints: Array.isArray(entry?.bulletPoints)
              ? entry.bulletPoints
                  .map((bullet) => String(bullet || "").trim().slice(0, 220))
                  .filter(Boolean)
                  .slice(0, 8)
              : [],
            startDate: String(entry?.startDate || "").trim().slice(0, 20),
            endDate: String(entry?.endDate || "").trim().slice(0, 20),
          }))
          .filter((entry) => entry.jobTitle || entry.bulletPoints.length > 0)
          .slice(0, 12);
      }

      if (preferredLocation !== undefined) {
        updates.preferredLocation = String(preferredLocation || "").trim().slice(0, 120);
      }

      if (preferredCategory !== undefined) {
        updates.preferredCategory = toSkillKey(String(preferredCategory || "").trim().slice(0, 80));
      }

      if (preferredCategories !== undefined) {
        if (!Array.isArray(preferredCategories)) {
          return res.status(400).json({
            success: false,
            message: "preferredCategories must be an array",
          });
        }
        updates.preferredCategories = preferredCategories
          .map((entry) => toSkillKey(String(entry || "").trim().slice(0, 80)))
          .filter(Boolean)
          .slice(0, 2);
        if (updates.preferredCategories.length > 0) {
          updates.preferredCategory = updates.preferredCategories[0];
        }
      }

      if (isFirstLogin !== undefined) {
        updates.isFirstLogin = Boolean(isFirstLogin);
      }

      if (profilePicture !== undefined) {
        const normalizedProfilePicture = normalizeCloudinarySecureUrl(profilePicture);
        if (
          normalizedProfilePicture &&
          !normalizedProfilePicture.startsWith("https://res.cloudinary.com/")
        ) {
          return res.status(400).json({
            success: false,
            message: "profilePicture must be a valid Cloudinary secure URL",
          });
        }
        updates.profilePicture = normalizedProfilePicture;
      }
    }

    if (role === "employer") {
      if (companyName !== undefined) {
        updates.companyName = String(companyName || "").trim();
      }

      if (companyLogo !== undefined) {
        updates.companyLogo = normalizeCloudinarySecureUrl(companyLogo);
      }

      if (companyCoverPicture !== undefined) {
        updates.companyCoverPicture = normalizeCloudinarySecureUrl(companyCoverPicture);
      }

      if (companyWebsite !== undefined) {
        updates.companyWebsite = String(companyWebsite || "").trim();
      }

      if (companyAddress !== undefined) {
        updates.companyAddress = String(companyAddress || "").trim().slice(0, 220);
      }

      if (companySize !== undefined) {
        updates.companySize = String(companySize || "").trim().slice(0, 80);
      }

      if (businessRegistration !== undefined) {
        updates.businessRegistration = String(businessRegistration || "").trim();
      }

      if (companyDescription !== undefined) {
        updates.companyDescription = String(companyDescription || "").trim().slice(0, 500);
      }

      if (businessPhoneNumber !== undefined) {
        updates.businessPhoneNumber = String(businessPhoneNumber || "").trim();
      }

      if (businessTelegramUsername !== undefined) {
        updates.businessTelegramUsername = String(businessTelegramUsername || "")
          .trim()
          .replace(/^@/, "");
      }

      const parsedLocation = parseCompanyLocation(companyLocation);
      if (parsedLocation.error) {
        return res.status(400).json({
          success: false,
          message: parsedLocation.error,
        });
      }
      if (parsedLocation.provided) {
        updates.companyLocation = parsedLocation.data;
        if (updates.companyAddress === undefined) {
          updates.companyAddress = String(parsedLocation.data?.address || "").trim();
        }
      }
    }

    if (preferredContactMethod !== undefined) {
      const method = sanitizePreferredContactMethod(preferredContactMethod);
      if (!method) {
        return res.status(400).json({
          success: false,
          message: "preferredContactMethod must be one of: phone, telegram, none",
        });
      }
      updates.preferredContactMethod = method;
    }

    if (preferredLanguage !== undefined) {
      const nextLanguage = String(preferredLanguage || "").trim().toLowerCase();
      if (!["en", "km", "zh"].includes(nextLanguage)) {
        return res.status(400).json({
          success: false,
          message: "preferredLanguage must be one of: en, km, zh",
        });
      }
      updates.preferredLanguage = nextLanguage;
    }

    const nextPhone =
      role === "employer"
        ? updates.businessPhoneNumber ?? req.user.businessPhoneNumber ?? ""
        : updates.phoneNumber ?? req.user.phoneNumber ?? "";
    const nextTelegram =
      role === "employer"
        ? updates.businessTelegramUsername ?? req.user.businessTelegramUsername ?? ""
        : updates.telegramUsername ?? req.user.telegramUsername ?? "";
    const nextMethod =
      updates.preferredContactMethod ?? req.user.preferredContactMethod ?? "none";

    if (nextMethod === "phone" && !String(nextPhone).trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required when preferred contact method is phone",
      });
    }

    if (nextMethod === "telegram" && !String(nextTelegram).trim()) {
      return res.status(400).json({
        success: false,
        message: "Telegram username is required when preferred contact method is telegram",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true })
      .select("-password");
    await Promise.all([
      syncCatalogTerms({
        kind: "skill",
        values: updates.skills !== undefined ? updates.skills : updatedUser.skills,
        userId: req.user.id,
      }),
      syncCatalogTerms({
        kind: "category",
        values:
          updates.preferredCategories !== undefined
            ? updates.preferredCategories
            : updatedUser.preferredCategories,
        userId: req.user.id,
      }),
    ]);
    const [candidateBonusUser, employerBonusUser] = await Promise.all([
      applyCandidateProfileBonusIfEligible(req.user.id),
      applyEmployerLocationBonusIfEligible(req.user.id),
    ]);
    const finalUser = employerBonusUser || candidateBonusUser || updatedUser;

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: serializeAuthUser(finalUser, {
        isAdmin: Boolean(req.user?.isAdmin),
        adminRole: req.user?.adminRole || "none",
      }),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update profile: ${error.message}`,
    });
  }
};
