import Job from "../models/Job.js";
import CatalogTerm from "../models/CatalogTerm.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Application from "../models/Application.js";
import { createAndEmitNotification } from "../socket/notifications.js";
import { toSkillKey } from "../utils/skills.js";
import jwt from "jsonwebtoken";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toCatalogLabel = (value = "") =>
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

export const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      salary,
      location,
      requiredSkills,
      isFeatured,
      category,
      vacancies,
      hiringLimit,
      is_remote,
      experience_requirement,
    } =
      req.body;

    const fallbackLocation = req.user?.companyLocation || {};
    const nextLocation = {
      address: String(location?.address || fallbackLocation?.address || "").trim(),
      lat: location?.lat ?? fallbackLocation?.lat,
      lng: location?.lng ?? fallbackLocation?.lng,
    };

    if (!title || !description || !salary || !category || nextLocation.lat === undefined || nextLocation.lat === null || nextLocation.lng === undefined || nextLocation.lng === null) {
      return res.status(400).json({
        success: false,
        message: "title, description, salary, category, and location coordinates are required",
      });
    }

    if (!experience_requirement) {
      return res.status(400).json({
        success: false,
        message: "experience_requirement is required",
      });
    }

    const allowedExperience = ["no_experience", "junior", "senior"];
    if (!allowedExperience.includes(String(experience_requirement))) {
      return res.status(400).json({
        success: false,
        message: `Invalid experience_requirement. Allowed: ${allowedExperience.join(", ")}`,
      });
    }

    const normalizedSkills = Array.isArray(requiredSkills)
      ? requiredSkills.map((skill) => toSkillKey(skill)).filter(Boolean)
      : [];

    const lat = Number(nextLocation.lat);
    const lng = Number(nextLocation.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Invalid location coordinates",
      });
    }

    const geoPoint = {
      type: "Point",
      coordinates: [lng, lat],
    };
    const normalizedVacancies = Math.max(1, Number(vacancies ?? hiringLimit) || 1);
    const isRemote = Boolean(is_remote);
    const tierLevel = isRemote ? "remote" : String(experience_requirement);
    const experienceLevel =
      experience_requirement === "no_experience" ? "entry" : String(experience_requirement);
    const minExperience =
      experience_requirement === "no_experience"
        ? 0
        : experience_requirement === "junior"
          ? 1
          : 3;

    const normalizedCategory = String(category || "").trim();

    const job = await Job.create({
      title: title.trim(),
      description: description.trim(),
      salary: String(salary).trim(),
      employerId: req.user.id,
      companyId: req.user.id,
      isFeatured: Boolean(isFeatured),
      category: normalizedCategory,
      requiredSkills: normalizedSkills,
      is_remote: isRemote,
      tier_level: tierLevel,
      isRemote,
      experienceLevel,
      min_experience: minExperience,
      vacancies: normalizedVacancies,
      hiredCount: 0,
      hiringLimit: normalizedVacancies,
      companyProfile: {
        companyName: req.user.companyName || req.user.name || "Independent Employer",
        companyLogo: req.user.companyLogo || "",
        companyWebsite: req.user.companyWebsite || "",
        companySize: req.user.companySize || "",
        businessRegistration: req.user.businessRegistration || "",
        companyDescription: req.user.companyDescription || "",
      },
      location: {
        lat,
        lng,
        address: nextLocation.address || "",
        geo: geoPoint,
      },
      metadata: {
        ai_indexed_at: new Date(),
      },
    });

    await Promise.all([
      syncCatalogTerms({ kind: "category", values: [normalizedCategory], userId: req.user.id }),
      syncCatalogTerms({ kind: "skill", values: normalizedSkills, userId: req.user.id }),
    ]);

    const matchedCandidates = await User.find({
      accountType: "candidate",
      $or: [
        { preferredCategories: normalizedCategory },
        { preferredCategory: normalizedCategory },
      ],
    }).select("_id");

    if (matchedCandidates.length) {
      const companyName =
        req.user.companyName || req.user.name || "WorkCloud Employer";
      const alertMessage = `ការងារថ្មីសម្រាប់អ្នក! ${companyName} កំពុងរើស ${job.title} ក្នុងផ្នែក ${normalizedCategory}។`;
      const alertMetadata = {
        jobId: job._id,
        jobTitle: job.title || "",
        companyName,
        category: normalizedCategory,
        jobCategory: normalizedCategory,
        interviewLink: "",
      };

      const notifications = await Notification.insertMany(
        matchedCandidates.map((candidate) => ({
          recipientId: candidate._id,
          senderId: req.user.id,
          senderName: companyName,
          senderProfilePic: req.user.companyLogo || req.user.profilePicture || "",
          message: alertMessage,
          messageKey: "",
          type: "job_alert",
          isRead: false,
          metadata: alertMetadata,
        }))
      );

      await Promise.all(
        notifications.map((notificationDoc) =>
          createAndEmitNotification({
            recipientId: notificationDoc.recipientId,
            senderId: req.user.id,
            senderName: companyName,
            senderProfilePic: req.user.companyLogo || req.user.profilePicture || "",
            message: alertMessage,
            messageKey: "",
            type: "job_alert",
            metadata: alertMetadata,
            persist: false,
            existingNotification: notificationDoc,
          })
        )
      );
    }

    return res.status(201).json({
      success: true,
      message: "Job posted successfully",
      job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to create job: ${error.message}`,
    });
  }
};

export const getJobs = async (_req, res) => {
  try {
    const { category } = _req.query;
    const filter = {
      $or: [{ status: "open" }, { status: { $exists: false } }, { status: null }],
    };
    if (category) {
      filter.category = { $regex: new RegExp(`^${escapeRegex(String(category).trim())}$`, "i") };
    }

    let currentUser = null;
    const authHeader = _req.headers?.authorization || "";
    if (authHeader.startsWith("Bearer ") && process.env.JWT_SECRET) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser = await User.findById(decoded.id).select(
          "preferredCategory preferredCategories accountType role isVerified skills"
        );
      } catch {
        currentUser = null;
      }
    }

    const canRankBySkills = Boolean(currentUser);
    const preferredCategoryKeys = Array.from(
      new Set(
        [
          ...(Array.isArray(currentUser?.preferredCategories)
            ? currentUser.preferredCategories
            : []),
          currentUser?.preferredCategory,
        ]
          .map((entry) => toSkillKey(String(entry || "").trim()))
          .filter(Boolean)
      )
    );
    const userSkills = Array.isArray(currentUser?.skills)
      ? currentUser.skills
          .map((skill) => {
            if (typeof skill === "string") {
              return toSkillKey(skill);
            }
            if (skill && typeof skill === "object") {
              return toSkillKey(skill.name || "");
            }
            return "";
          })
          .filter(Boolean)
      : [];

    let jobs;
    const pipeline = [{ $match: filter }];

    if (preferredCategoryKeys.length > 0) {
      pipeline.push({
        $addFields: {
          normalizedCategoryKey: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: {
                    $toLower: { $trim: { input: { $ifNull: ["$category", ""] } } },
                  },
                  find: "/",
                  replacement: "_",
                },
              },
              find: " ",
              replacement: "_",
            },
          },
          categoryBoost: {
            $cond: [
              {
                $in: [
                  "$normalizedCategoryKey",
                  preferredCategoryKeys,
                ],
              },
              1,
              0,
            ],
          },
        },
      });
    } else {
      pipeline.push({
        $addFields: { categoryBoost: 0 },
      });
    }

    if (canRankBySkills && userSkills.length > 0) {
      pipeline.push(
        {
          $addFields: {
            normalizedRequiredSkills: {
              $cond: [
                { $isArray: "$requiredSkills" },
                "$requiredSkills",
                {
                  $cond: [{ $isArray: "$requirements" }, "$requirements", []],
                },
              ],
            },
          },
        },
        {
          $addFields: {
            normalizedRequiredSkills: {
              $map: {
                input: "$normalizedRequiredSkills",
                as: "skill",
                in: {
                  $toLower: {
                    $trim: {
                      input: { $toString: "$$skill" },
                    },
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            matchSkills: { $setIntersection: ["$normalizedRequiredSkills", userSkills] },
          },
        },
        {
          $addFields: {
            skillBoost: { $size: "$matchSkills" },
            rankingScore: {
              $add: [{ $multiply: ["$categoryBoost", 10] }, { $size: "$matchSkills" }],
            },
          },
        },
        { $sort: { rankingScore: -1, skillBoost: -1, createdAt: -1 } }
      );
    } else {
      pipeline.push(
        {
          $addFields: { rankingScore: "$categoryBoost" },
        },
        { $sort: { rankingScore: -1, createdAt: -1 } }
      );
    }

    jobs = await Job.aggregate(pipeline);
    jobs = await Job.populate(jobs, {
      path: "employerId",
      select:
        "name email trustScore companyName companyLogo companyWebsite companySize businessRegistration companyDescription",
    });

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch jobs: ${error.message}`,
    });
  }
};

export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    let job = await Job.findByIdAndUpdate(
      id,
      { $inc: { views: 1, "metadata.views": 1 } },
      { new: true }
    ).populate(
      "employerId",
      "name email trustScore companyName companyLogo companyWebsite companySize businessRegistration companyDescription"
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const liveHiredCount = await Application.countDocuments({
      jobId: job._id,
      status: { $in: ["accepted", "contracted", "awaiting_confirmation", "completed"] },
    });
    const normalizedVacancies = Math.max(1, Number(job.vacancies ?? job.hiringLimit) || 1);
    const nextStatus = liveHiredCount >= normalizedVacancies ? "closed" : job.status;

    if (
      Number(job.hiredCount || 0) !== Number(liveHiredCount) ||
      Number(job.vacancies ?? job.hiringLimit ?? 1) !== normalizedVacancies ||
      String(job.status || "") !== String(nextStatus || "")
    ) {
      job.hiredCount = liveHiredCount;
      job.vacancies = normalizedVacancies;
      job.hiringLimit = normalizedVacancies;
      job.status = nextStatus;
      await job.save();
    }

    const currentViews = Math.max(Number(job.views || 0), Number(job?.metadata?.views || 0));
    if (currentViews > 0 && currentViews % 10 === 0 && (job.companyId || job.employerId)) {
      await createAndEmitNotification({
        recipientId: job.companyId || job.employerId,
        senderId: null,
        senderName: "WorkCloud",
        senderProfilePic: "",
        type: "system",
        message: `Your job post "${job.title || "Job"}" has reached ${currentViews} views.`,
        metadata: {
          jobId: job._id,
          jobTitle: job.title || "",
          views: currentViews,
        },
      });
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch job: ${error.message}`,
    });
  }
};

export const getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ companyId: req.user.id }).sort({ createdAt: -1 }).lean();
    const jobIds = jobs.map((job) => job._id);
    let applicationStatsMap = new Map();

    if (jobIds.length > 0) {
      const applicationStats = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
          $group: {
            _id: "$jobId",
            applicantsCount: { $sum: 1 },
            contractedCount: {
              $sum: {
                $cond: [{ $in: ["$status", ["contracted", "completed"]] }, 1, 0],
              },
            },
          },
        },
      ]);

      applicationStatsMap = new Map(
        applicationStats.map((item) => [
          String(item._id),
          {
            applicantsCount: Number(item.applicantsCount || 0),
            contractedCount: Number(item.contractedCount || 0),
          },
        ])
      );
    }

    const decoratedJobs = jobs.map((job) => {
      const stats = applicationStatsMap.get(String(job._id)) || {
        applicantsCount: 0,
        contractedCount: 0,
      };
      const normalizedVacancies = Math.max(1, Number(job.vacancies ?? job.hiringLimit) || 1);
      const normalizedHiredCount = Math.max(
        0,
        Number(job.hiredCount ?? stats.contractedCount) || 0
      );
      const isFilled = normalizedHiredCount >= normalizedVacancies;

      return {
        ...job,
        applicantsCount: stats.applicantsCount,
        contractedCount: normalizedHiredCount,
        hiredCount: normalizedHiredCount,
        vacancies: normalizedVacancies,
        hiringLimit: normalizedVacancies,
        remainingSpots: Math.max(0, normalizedVacancies - normalizedHiredCount),
        isFilled,
      };
    });

    return res.status(200).json({
      success: true,
      count: decoratedJobs.length,
      jobs: decoratedJobs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch employer jobs: ${error.message}`,
    });
  }
};

export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (String(job.companyId || job.employerId) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: you can only update your own jobs" });
    }

    const updatableFields = [
      "title",
      "description",
      "salary",
      "category",
      "requiredSkills",
      "isFeatured",
      "status",
      "vacancies",
      "hiringLimit",
      "jobType",
      "urgency",
      "paymentStatus",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        job[field] = req.body[field];
      }
    });

    if (req.body.vacancies !== undefined || req.body.hiringLimit !== undefined) {
      const normalizedVacancies = Math.max(
        1,
        Number(req.body.vacancies ?? req.body.hiringLimit) || 1
      );
      if (normalizedVacancies < Number(job.hiredCount || 0)) {
        return res.status(400).json({
          success: false,
          message: "Vacancies cannot be lower than the current hired count",
        });
      }
      job.vacancies = normalizedVacancies;
      job.hiringLimit = normalizedVacancies;
    }

    if (req.body.category !== undefined) {
      job.category = String(req.body.category || "").trim();
    }

    if (req.body.requiredSkills !== undefined) {
      job.requiredSkills = Array.isArray(req.body.requiredSkills)
        ? req.body.requiredSkills.map((skill) => toSkillKey(skill)).filter(Boolean)
        : [];
    }

    if (req.body.location) {
      const lat = Number(req.body.location.lat);
      const lng = Number(req.body.location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ success: false, message: "Invalid location coordinates" });
      }

      job.location = {
        ...job.location,
        address: req.body.location.address || job.location?.address || "",
        lat,
        lng,
        geo: {
          type: "Point",
          coordinates: [lng, lat],
        },
      };
    }

    job.companyProfile = {
      companyName: req.user.companyName || req.user.name || "Independent Employer",
      companyLogo: req.user.companyLogo || "",
      companyWebsite: req.user.companyWebsite || "",
      companySize: req.user.companySize || "",
      businessRegistration: req.user.businessRegistration || "",
      companyDescription: req.user.companyDescription || "",
    };

    await job.save();

    await Promise.all([
      syncCatalogTerms({ kind: "category", values: [job.category], userId: req.user.id }),
      syncCatalogTerms({ kind: "skill", values: job.requiredSkills, userId: req.user.id }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Job updated successfully",
      job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update job: ${error.message}`,
    });
  }
};

export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (String(job.companyId || job.employerId) !== String(req.user.id)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: you can only delete your own jobs" });
    }

    await Promise.all([Job.findByIdAndDelete(id), Application.deleteMany({ jobId: id })]);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to delete job: ${error.message}`,
    });
  }
};

export const toggleSaveJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id).select("_id");

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const user = await User.findById(req.user.id).select("savedJobs");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const alreadySaved = user.savedJobs.some((savedJobId) => String(savedJobId) === String(id));

    const update = alreadySaved
      ? { $pull: { savedJobs: id } }
      : { $addToSet: { savedJobs: id } };

    const updatedUser = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      select: "savedJobs",
    });

    return res.status(200).json({
      success: true,
      saved: !alreadySaved,
      savedJobs: (updatedUser?.savedJobs || []).map((jobId) => String(jobId)),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to toggle saved job: ${error.message}`,
    });
  }
};

export const getSavedJobs = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "savedJobs",
      options: { sort: { createdAt: -1 } },
      populate: {
        path: "employerId",
        select:
          "name email trustScore companyName companyLogo companyWebsite companySize businessRegistration companyDescription",
      },
    });

    return res.status(200).json({
      success: true,
      count: user?.savedJobs?.length || 0,
      jobs: user?.savedJobs || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch saved jobs: ${error.message}`,
    });
  }
};
