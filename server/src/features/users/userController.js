import User from "./User.js";
import Application from "../applications/Application.js";
import CandidateReview from "../reviews/CandidateReview.js";
import {
  applyCandidateProfileBonusIfEligible,
  applyEmployerLocationBonusIfEligible,
} from "../../shared/utils/profileBonus.js";
import cloudinary, { configureCloudinary, isCloudinaryConfigured } from "../../infrastructure/cloud-storage/cloudinary.js";

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.accountType || user.role,
  trustScore: user.trustScore,
  preferredLanguage: user.preferredLanguage,
  verifiedBadges: user.verifiedBadges || [],
  phoneNumber: user.phoneNumber || "",
  telegramUsername: user.telegramUsername || "",
  businessPhoneNumber: user.businessPhoneNumber || "",
  businessTelegramUsername: user.businessTelegramUsername || "",
  preferredContactMethod: user.preferredContactMethod || "none",
  bio: user.bio || "",
  university: user.university || "",
  school: user.school || "",
  skills: Array.isArray(user.skills) ? user.skills : [],
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
});

const sanitizePreferredContactMethod = (value) => {
  const method = String(value || "").trim().toLowerCase();
  return ["phone", "telegram", "none"].includes(method) ? method : null;
};

const parseCompanyLocation = (value) => {
  if (value === undefined) {
    return { provided: false, data: null, error: "" };
  }

  let raw = value;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    raw = trimmed ? JSON.parse(trimmed) : {};
  }

  const address = String(raw?.address || "").trim();
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);

  if (!address && (raw?.lat === undefined || raw?.lng === undefined)) {
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

const ACTIVE_CONTRACT_STATUSES = ["contracted", "awaiting_confirmation", "completed"];

const hasActiveContractBetween = async ({ employerId, candidateId }) => {
  const activeContract = await Application.findOne({
    companyId: employerId,
    candidateId,
    status: { $in: ACTIVE_CONTRACT_STATUSES },
  }).select("_id");

  return Boolean(activeContract);
};

export const getPublicEmployerProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const employer = await User.findById(id).select(
      "name accountType role companyName companyLogo companyCoverPicture companyDescription companyWebsite companyAddress companySize companyLocation businessPhoneNumber businessTelegramUsername rating"
    );

    if (!employer) {
      return res.status(404).json({
        success: false,
        message: "Employer not found",
      });
    }

    const role = employer.accountType || employer.role;
    if (role !== "employer") {
      return res.status(404).json({
        success: false,
        message: "Employer not found",
      });
    }

    const aggregate = await CandidateReview.aggregate([
      { $match: { companyId: employer._id } },
      {
        $group: {
          _id: "$companyId",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const reviewStats = aggregate[0] || null;
    const averageRating = reviewStats
      ? Number(Number(reviewStats.averageRating || 0).toFixed(1))
      : Number(Number(employer.rating || 0).toFixed(1));

    return res.status(200).json({
      success: true,
      profile: {
        id: employer._id,
        companyName: employer.companyName || employer.name || "Company",
        companyLogo: employer.companyLogo || "",
        companyCoverPicture: employer.companyCoverPicture || "",
        companyDescription: employer.companyDescription || "",
        companyWebsite: employer.companyWebsite || "",
        companyAddress: employer.companyAddress || employer.companyLocation?.address || "",
        companySize: employer.companySize || "",
        businessPhoneNumber: employer.businessPhoneNumber || "",
        businessTelegramUsername: employer.businessTelegramUsername || "",
        averageRating,
        totalReviews: Number(reviewStats?.totalReviews || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch employer public profile: ${error.message}`,
    });
  }
};

export const getPublicCandidateProfileForEmployer = async (req, res) => {
  try {
    const employerRole = req.user?.accountType || req.user?.role;
    if (employerRole !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: only employers can view candidate public profiles",
      });
    }

    const { id } = req.params;

    const candidate = await User.findById(id).select(
      "name email accountType role trustScore verifiedApplicationsCount bio preferredContactMethod phoneNumber telegramUsername profilePicture verifiedBadges"
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const candidateRole = candidate.accountType || candidate.role;
    if (candidateRole !== "candidate") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const [applicationStats, reviewStats, canViewSensitiveContact] = await Promise.all([
      Application.aggregate([
        { $match: { candidateId: candidate._id } },
        {
          $group: {
            _id: "$candidateId",
            totalApplications: { $sum: 1 },
            acceptedApplications: {
              $sum: {
                $cond: [{ $in: ["$status", ACTIVE_CONTRACT_STATUSES] }, 1, 0],
              },
            },
          },
        },
      ]),
      CandidateReview.aggregate([
        { $match: { candidateId: candidate._id } },
        {
          $group: {
            _id: "$candidateId",
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
      hasActiveContractBetween({ employerId: req.user.id, candidateId: candidate._id }),
    ]);

    const appStat = applicationStats[0] || { totalApplications: 0, acceptedApplications: 0 };
    const totalApplications = Number(appStat.totalApplications || 0);
    const acceptedApplications = Number(appStat.acceptedApplications || 0);
    const successRate =
      totalApplications > 0 ? Math.round((acceptedApplications / totalApplications) * 100) : 0;

    const reviewStat = reviewStats[0] || { averageRating: 0, totalReviews: 0 };

    return res.status(200).json({
      success: true,
      profile: {
        id: candidate._id,
        name: candidate.name || "Candidate",
        email: candidate.email || "",
        trustScore: Number(candidate.trustScore || 0),
        verifiedApplicationsCount: Number(candidate.verifiedApplicationsCount || 0),
        bio: candidate.bio || "",
        profilePicture: candidate.profilePicture || "",
        preferredContactMethod: candidate.preferredContactMethod || "none",
        verifiedBadges: candidate.verifiedBadges || [],
        stats: {
          totalApplications,
          acceptedApplications,
          successRate,
          averageRating: Number(Number(reviewStat.averageRating || 0).toFixed(1)),
          totalReviews: Number(reviewStat.totalReviews || 0),
        },
        contact: canViewSensitiveContact
          ? {
              phoneNumber: candidate.phoneNumber || "",
              telegramUsername: candidate.telegramUsername || "",
            }
          : null,
        canViewSensitiveContact,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch candidate public profile: ${error.message}`,
    });
  }
};

export const updateProfilePicture = async (req, res) => {
  try {
    configureCloudinary();

    const userRole = req.user?.accountType || req.user?.role;
    if (userRole !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidate accounts can update profile pictures",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile picture file is required",
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary is not configured on the server",
      });
    }

    const uploaded = await new Promise((resolve, reject) => {
      const configuredPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
      const uploadOptions = {
        folder: "workcloud/profile-pictures",
        resource_type: "image",
        public_id: `${req.user.id}-${Date.now()}`,
        overwrite: true,
        transformation: [{ width: 512, height: 512, crop: "limit" }],
      };
      if (configuredPreset) {
        uploadOptions.upload_preset = configuredPreset;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        }
      );

      uploadStream.end(req.file.buffer);
    });

    const secureUrl = String(uploaded?.secure_url || "")
      .trim()
      .replace(/^http:\/\//i, "https://");

    if (!secureUrl) {
      throw new Error("Failed to generate profile picture URL");
    }

    await User.findByIdAndUpdate(req.user.id, {
      $set: { profilePicture: secureUrl },
    });

    const userWithBonus = await applyCandidateProfileBonusIfEligible(req.user.id);
    const finalUser = userWithBonus || (await User.findById(req.user.id));

    return res.status(200).json({
      success: true,
      message: "Profile picture updated",
      profilePicture: secureUrl,
      user: serializeUser(finalUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to upload profile picture: ${error.message}`,
    });
  }
};

export const updateEmployerProfileWithLogo = async (req, res) => {
  try {
    configureCloudinary();

    const userRole = req.user?.accountType || req.user?.role;
    if (userRole !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Only employer accounts can update company profile",
      });
    }

    const updates = {};
    const {
      companyName,
      companyWebsite,
      businessRegistration,
      companyDescription,
      companyCoverPicture,
      companyAddress,
      companySize,
      preferredContactMethod,
      businessPhoneNumber,
      businessTelegramUsername,
      companyLocation,
    } = req.body;

    if (companyName !== undefined) {
      updates.companyName = String(companyName || "").trim();
    }
    if (companyWebsite !== undefined) {
      updates.companyWebsite = String(companyWebsite || "").trim();
    }
    if (businessRegistration !== undefined) {
      updates.businessRegistration = String(businessRegistration || "").trim();
    }
    if (companyDescription !== undefined) {
      updates.companyDescription = String(companyDescription || "").trim().slice(0, 500);
    }
    if (companyCoverPicture !== undefined) {
      updates.companyCoverPicture = String(companyCoverPicture || "").trim();
    }
    if (companyAddress !== undefined) {
      updates.companyAddress = String(companyAddress || "").trim().slice(0, 220);
    }
    if (companySize !== undefined) {
      updates.companySize = String(companySize || "").trim().slice(0, 80);
    }
    if (businessPhoneNumber !== undefined) {
      updates.businessPhoneNumber = String(businessPhoneNumber || "").trim();
    }
    if (businessTelegramUsername !== undefined) {
      updates.businessTelegramUsername = String(businessTelegramUsername || "")
        .trim()
        .replace(/^@/, "");
    }

    try {
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
    } catch {
      return res.status(400).json({
        success: false,
        message: "companyLocation must be a valid JSON object",
      });
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

    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(500).json({
          success: false,
          message: "Cloudinary is not configured on the server",
        });
      }

      const uploaded = await new Promise((resolve, reject) => {
        const configuredPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
        const uploadOptions = {
          folder: "workcloud/company-logos",
          resource_type: "image",
          public_id: `company-logo-${req.user.id}-${Date.now()}`,
          overwrite: true,
          transformation: [{ width: 500, height: 500, crop: "limit" }],
        };
        if (configuredPreset) {
          uploadOptions.upload_preset = configuredPreset;
        }

        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        });
        uploadStream.end(req.file.buffer);
      });

      const secureUrl = String(uploaded?.secure_url || "")
        .trim()
        .replace(/^http:\/\//i, "https://");

      if (!secureUrl) {
        throw new Error("Failed to generate company logo URL");
      }

      updates.companyLogo = secureUrl;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No valid company profile fields provided",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );
    const userWithBonus = await applyEmployerLocationBonusIfEligible(req.user.id);
    const finalUser = userWithBonus || updatedUser;

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      user: serializeUser(finalUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update company profile: ${error.message}`,
    });
  }
};

export const updateCompanyCoverPicture = async (req, res) => {
  try {
    configureCloudinary();

    const userRole = req.user?.accountType || req.user?.role;
    if (userRole !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Only employer accounts can update company cover picture",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Cover picture file is required",
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary is not configured on the server",
      });
    }

    const uploaded = await new Promise((resolve, reject) => {
      const configuredPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
      const uploadOptions = {
        folder: "workcloud/company-covers",
        resource_type: "image",
        public_id: `company-cover-${req.user.id}-${Date.now()}`,
        overwrite: true,
        transformation: [{ width: 1600, height: 600, crop: "limit" }],
      };
      if (configuredPreset) {
        uploadOptions.upload_preset = configuredPreset;
      }

      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });

      uploadStream.end(req.file.buffer);
    });

    const secureUrl = String(uploaded?.secure_url || "")
      .trim()
      .replace(/^http:\/\//i, "https://");

    if (!secureUrl) {
      throw new Error("Failed to generate company cover URL");
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { companyCoverPicture: secureUrl } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Company cover picture updated",
      companyCoverPicture: secureUrl,
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to upload company cover picture: ${error.message}`,
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const updates = {};

    if (req.body.preferredLanguage !== undefined) {
      const nextLanguage = String(req.body.preferredLanguage || "").trim().toLowerCase();
      if (!["en", "km", "zh"].includes(nextLanguage)) {
        return res.status(400).json({
          success: false,
          message: "preferredLanguage must be one of: en, km, zh",
        });
      }
      updates.preferredLanguage = nextLanguage;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No valid profile fields provided",
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true });
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update user profile: ${error.message}`,
    });
  }
};

export const updateLanguagePreference = async (req, res) => {
  try {
    const nextLanguage = String(req.body.preferredLanguage || "").trim().toLowerCase();
    if (!["en", "km", "zh"].includes(nextLanguage)) {
      return res.status(400).json({
        success: false,
        message: "preferredLanguage must be one of: en, km, zh",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { preferredLanguage: nextLanguage } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Language updated successfully",
      user: serializeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update language: ${error.message}`,
    });
  }
};
