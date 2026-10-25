import Application from "../models/Application.js";
import CandidateReview from "../models/CandidateReview.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { createAndEmitNotification } from "../socket/notifications.js";
import { applyTrustDelta, clampTrustScore } from "../utils/trustScore.js";

const TRUST_SCORE_INCREMENT = 10;
const TRUST_SCORE_DECREMENT = 20;
const REVIEW_TRUST_SCORE_DELTA_BY_RATING = {
  1: -10,
  2: -5,
  3: 0,
  4: 5,
  5: 10,
};
const DEFAULT_EXPERIENCE_BULLETS = [
  "Delivered role-specific outcomes with strong reliability and quality standards.",
  "Collaborated across teams to improve execution speed and service consistency.",
  "Maintained clear communication and contributed to measurable operational results.",
];
const HIRE_COUNTED_STATUSES = ["accepted", "contracted", "awaiting_confirmation", "completed"];

const isRemoteJobRecord = (job) =>
  Boolean(job?.isRemote) ||
  Boolean(job?.is_remote) ||
  String(job?.jobType || "").toLowerCase() === "remote";

const getInterviewStartAt = (interviewDate, interviewTime) => {
  const normalizedDate = String(interviewDate || "").trim();
  const normalizedTime = String(interviewTime || "").trim();
  if (!normalizedDate || !normalizedTime) {
    return null;
  }
  const parsedDate = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatInterviewDateTime = (interviewDate, interviewTime) => {
  const startAt = getInterviewStartAt(interviewDate, interviewTime);
  if (!startAt) {
    return "";
  }
  return startAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const sanitizeCvText = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value) =>
  sanitizeCvText(value)
    .split(" ")
    .filter(Boolean)
    .map((entry) => `${entry[0].toUpperCase()}${entry.slice(1).toLowerCase()}`)
    .join(" ")
    .trim();

const toProfessionalSkillLabel = (skill) => toTitleCase(skill);

const syncJobHiringProgress = async ({ jobId, employerId = null, notifyOnClose = false }) => {
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedJobId) {
    return { job: null, filled: false, justClosed: false };
  }

  const [job, hiredCount] = await Promise.all([
    Job.findById(normalizedJobId),
    Application.countDocuments({
      jobId: normalizedJobId,
      status: { $in: HIRE_COUNTED_STATUSES },
    }),
  ]);

  if (!job) {
    return { job: null, filled: false, justClosed: false };
  }

  const normalizedVacancies = Math.max(
    1,
    Number(job.vacancies ?? job.hiringLimit) || 1
  );
  const nextHiredCount = Math.max(0, Number(hiredCount || 0));
  const filled = nextHiredCount >= normalizedVacancies;
  const previousStatus = String(job.status || "open").toLowerCase();
  const justClosed = filled && previousStatus !== "closed";

  job.vacancies = normalizedVacancies;
  job.hiringLimit = normalizedVacancies;
  job.hiredCount = nextHiredCount;
  if (filled) {
    job.status = "closed";
  }
  await job.save();

  if (notifyOnClose && justClosed) {
    const ownerCompanyId = employerId || job.companyId || job.employerId;
    if (ownerCompanyId) {
      await createAndEmitNotification({
        recipientId: ownerCompanyId,
        senderId: null,
        senderName: "WorkCloud",
        senderProfilePic: "",
        type: "system",
        message: `Your job "${job.title || "Job"}" has been closed automatically because all ${normalizedVacancies} openings are filled.`,
        metadata: {
          jobId: job._id,
          jobTitle: job.title || "",
          vacancies: normalizedVacancies,
          hiredCount: nextHiredCount,
          reason: "vacancies_filled",
        },
      });
    }
  }

  return { job, filled, justClosed };
};

const parseEducationEntry = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^(.*?)(?:\s*\(([^()]*)\))?$/);
  const title = toTitleCase(match?.[1] || text);
  const rawDateRange = String(match?.[2] || "").trim();
  const dateMatch = rawDateRange.match(/^([^()]*)\s*-\s*([^()]*)$/);
  const startDate = String(dateMatch?.[1] || "").trim();
  const endDate = String(dateMatch?.[2] || "").trim();
  return {
    title,
    dateRange: `${startDate || "MM/YYYY"} - ${endDate || "End Date"}`,
  };
};

const buildCvSnapshot = async (candidate) => {
  const historyAppIds = Array.isArray(candidate?.history) ? candidate.history : [];
  const savedWorkExperience = Array.isArray(candidate?.workExperience)
    ? candidate.workExperience
        .map((entry) => ({
          title: toTitleCase(entry?.jobTitle || "Professional Experience"),
          dateRange: `${sanitizeCvText(entry?.startDate) || "MM/YYYY"} - ${
            sanitizeCvText(entry?.endDate) || "Present"
          }`,
          bullets: Array.isArray(entry?.bulletPoints)
            ? entry.bulletPoints.map((line) => sanitizeCvText(line)).filter(Boolean).slice(0, 6)
            : [],
        }))
        .filter((entry) => entry.title)
    : [];
  let priorExperiences = [];

  if (historyAppIds.length) {
    priorExperiences = await Application.find({
      _id: { $in: historyAppIds },
      status: { $in: ["contracted", "completed"] },
    })
      .sort({ updatedAt: -1 })
      .limit(4)
      .populate("jobId", "title")
      .lean();
  }

  const experienceFromHistory = priorExperiences
    .map((entry) => ({
      title: toTitleCase(entry?.jobId?.title || "Professional Experience"),
      dateRange: entry?.handshakeAt
        ? new Date(entry.handshakeAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
        : "Date Not Provided",
      bullets: DEFAULT_EXPERIENCE_BULLETS,
    }))
    .filter((entry) => entry.title);

  const experiences = (savedWorkExperience.length ? savedWorkExperience : experienceFromHistory).map(
    (entry) => ({
      ...entry,
      bullets: entry.bullets?.length ? entry.bullets : DEFAULT_EXPERIENCE_BULLETS,
    })
  );

  const education =
    Array.isArray(candidate?.educationHistory) && candidate.educationHistory.length
      ? candidate.educationHistory
          .map((entry) => parseEducationEntry(entry))
          .filter((entry) => entry.title)
      : [candidate?.university, candidate?.school]
          .map((entry) => parseEducationEntry(entry))
          .filter((entry) => entry.title);

  const skills = Array.isArray(candidate?.skills)
    ? candidate.skills.map((entry) => toProfessionalSkillLabel(entry)).filter(Boolean)
    : [];
  const languages = Array.isArray(candidate?.languages)
    ? candidate.languages.map((entry) => sanitizeCvText(entry)).filter(Boolean)
    : [];

  const summarySource = sanitizeCvText(candidate?.bio);
  const summary =
    summarySource ||
    `Professional candidate with strengths in ${skills.slice(0, 4).join(", ") || "team collaboration and problem solving"}.`;

  return {
    fullName: sanitizeCvText(candidate?.name) || "Candidate",
    headline: "Professional Candidate",
    summary,
    profilePicture: String(candidate?.profilePicture || "").trim(),
    contact: {
      phone: sanitizeCvText(candidate?.phoneNumber) || "-",
      email: sanitizeCvText(candidate?.email) || "-",
      telegram: sanitizeCvText(candidate?.telegramUsername)
        ? `@${sanitizeCvText(candidate.telegramUsername).replace(/^@/, "")}`
        : "-",
    },
    skills,
    languages,
    experiences,
    education,
    isVerified: Boolean(candidate?.isVerified || (Array.isArray(candidate?.verifiedBadges) && candidate.verifiedBadges.length > 0)),
    generatedAt: new Date(),
  };
};

export const createApplication = async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    if (String(job.status || "open").toLowerCase() !== "open") {
      return res.status(400).json({ success: false, message: "This job is no longer accepting applications" });
    }
    const normalizedVacancies = Math.max(1, Number(job.vacancies ?? job.hiringLimit) || 1);
    const currentHiredCount = Math.max(0, Number(job.hiredCount || 0));
    if (currentHiredCount >= normalizedVacancies) {
      return res.status(400).json({ success: false, message: "All openings for this job have been filled" });
    }

    const ownerCompanyId = job.companyId || job.employerId;
    if (!ownerCompanyId) {
      return res.status(400).json({
        success: false,
        message: "Job company profile is not configured",
      });
    }

    const existing = await Application.findOne({ jobId, candidateId: req.user.id });
    if (existing) {
      return res.status(409).json({ success: false, message: "Already applied to this job" });
    }

    const candidate = await User.findById(req.user.id).select(
      "name email phoneNumber telegramUsername bio university school skills educationHistory workExperience languages profilePicture isVerified verifiedBadges history"
    );
    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    const cvSnapshot = await buildCvSnapshot(candidate);

    const application = await Application.create({
      jobId,
      candidateId: req.user.id,
      companyId: ownerCompanyId,
      status: "pending",
      cvSnapshot,
    });
    application.cvSnapshotUrl = `/api/applications/${application._id}/cv-snapshot`;
    await application.save();
    await Job.findByIdAndUpdate(jobId, {
      $inc: { "metadata.applyCount": 1 },
      $addToSet: { applicants: req.user.id },
    });

    await createAndEmitNotification({
      recipientId: ownerCompanyId,
      senderId: req.user.id,
      senderName: req.user.name || "Candidate",
      senderProfilePic: req.user.profilePicture || "",
      type: "new_application",
      message: `${req.user.name || "A candidate"} applied for ${job.title || "your job"}`,
      metadata: {
        applicationId: application._id,
        jobId: job._id,
        jobTitle: job.title || "",
        candidateName: req.user.name || "",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Application created",
      application,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: `Failed to apply: ${error.message}` });
  }
};

export const getCandidateApplications = async (req, res) => {
  try {
    const applications = await Application.find({ candidateId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("jobId", "title salary location employerId companyProfile jobType isRemote is_remote")
      .populate("candidateId", "name email")
      .populate({
        path: "jobId",
        populate: {
          path: "employerId",
          select: "name companyName companyLogo companyWebsite companySize companyDescription",
        },
      });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch applications: ${error.message}`,
    });
  }
};

export const getEmployerApplications = async (req, res) => {
  try {
    const companyId = req.user.id;
    const jobs = await Job.find({
      $or: [{ companyId }, { employerId: companyId }],
    }).select("_id status");
    const jobIds = jobs.map((job) => job._id);

    const applications = await Application.find({
      $or: [{ companyId }, { jobId: { $in: jobIds } }],
    })
      .sort({ createdAt: -1 })
      .populate(
        "candidateId",
        "name email trustScore verifiedBadges history verifiedApplicationsCount phoneNumber telegramUsername preferredContactMethod profilePicture location"
      )
      .populate("jobId", "title salary location employerId companyProfile companyId status jobType isRemote is_remote");

    const candidateIds = Array.from(
      new Set(applications.map((application) => String(application.candidateId?._id)).filter(Boolean))
    );

    const candidateObjectIds = candidateIds
      .map((id) => applicationIdFromString(id))
      .filter(Boolean);

    const rawStats = await Application.aggregate([
      {
        $match: {
          candidateId: { $in: candidateObjectIds },
        },
      },
      {
        $group: {
          _id: "$candidateId",
          totalApplications: { $sum: 1 },
          acceptedApplications: {
            $sum: {
              $cond: [{ $in: ["$status", ["accepted", "contracted", "completed"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const statsMap = new Map(
      rawStats.map((item) => [
        String(item._id),
        {
          totalApplications: item.totalApplications || 0,
          acceptedApplications: item.acceptedApplications || 0,
        },
      ])
    );

    const reviews = await CandidateReview.find({
      candidateId: { $in: candidateObjectIds },
    })
      .sort({ createdAt: -1 })
      .populate("employerId", "name companyName");

    const reviewSummaryMap = new Map();
    const reviewPreviewMap = new Map();
    const myCompanyReviewMap = new Map();

    reviews.forEach((review) => {
      const key = String(review.candidateId);
      const currentSummary = reviewSummaryMap.get(key) || {
        total: 0,
        sum: 0,
      };
      currentSummary.total += 1;
      currentSummary.sum += Number(review.rating || 0);
      reviewSummaryMap.set(key, currentSummary);

      const preview = reviewPreviewMap.get(key) || [];
      if (preview.length < 3) {
        preview.push({
          id: review._id,
          rating: review.rating,
          comment: review.comment || "",
          companyName: review.employerId?.companyName || review.employerId?.name || "Employer",
          createdAt: review.createdAt,
        });
        reviewPreviewMap.set(key, preview);
      }

      if (String(review.companyId) === String(companyId) && !myCompanyReviewMap.has(key)) {
        myCompanyReviewMap.set(key, {
          id: review._id,
          rating: review.rating,
          comment: review.comment || "",
        });
      }
    });

    const activeJobs = jobs.filter((job) => job.status === "open").length;
    const filledJobs = new Set(
      applications
        .filter((application) => ["contracted", "completed"].includes(application.status))
        .map((application) => String(application.jobId?._id))
        .filter(Boolean)
    ).size;

    const decoratedApplications = applications.map((application) => {
      const doc = application.toObject();
      const candidateId = String(doc.candidateId?._id || "");
      const canViewSensitiveContact = ["contracted", "awaiting_confirmation", "completed"].includes(
        String(doc.status || "").toLowerCase()
      );
      const stat = statsMap.get(candidateId) || {
        totalApplications: 0,
        acceptedApplications: 0,
      };
      const successRate =
        stat.totalApplications > 0
          ? Math.round((stat.acceptedApplications / stat.totalApplications) * 100)
          : 0;
      const reviewSummary = reviewSummaryMap.get(candidateId) || { total: 0, sum: 0 };
      const averageRating =
        reviewSummary.total > 0 ? Number((reviewSummary.sum / reviewSummary.total).toFixed(1)) : 0;

      return {
        ...doc,
        candidateId: {
          ...(doc.candidateId || {}),
          phoneNumber: canViewSensitiveContact ? doc.candidateId?.phoneNumber || "" : "",
          telegramUsername: canViewSensitiveContact ? doc.candidateId?.telegramUsername || "" : "",
        },
        canViewSensitiveContact,
        candidateStats: {
          ...stat,
          successRate,
        },
        candidateReviewSummary: {
          averageRating,
          totalReviews: reviewSummary.total,
        },
        candidateReviewsPreview: reviewPreviewMap.get(candidateId) || [],
        myCompanyReview: myCompanyReviewMap.get(candidateId) || null,
      };
    });

    return res.status(200).json({
      success: true,
      count: decoratedApplications.length,
      applications: decoratedApplications,
      summary: {
        activeJobs,
        filledJobs,
        totalJobs: jobIds.length,
      },
      companyLocation: {
        lat: Number(req.user?.location?.lat),
        lng: Number(req.user?.location?.lng),
        address: req.user?.location?.address || "",
      },
      companySettings: {
        companyName: req.user.companyName || req.user.name || "",
        businessPhoneNumber: req.user.businessPhoneNumber || "",
        businessTelegramUsername: req.user.businessTelegramUsername || "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch employer applications: ${error.message}`,
    });
  }
};

export const getEmployerApplicantsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId).select("_id companyId employerId title");
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const ownerCompanyId = job.companyId || job.employerId;
    if (String(ownerCompanyId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only access applicants for your own job",
      });
    }

    const applications = await Application.find({ jobId })
      .sort({ createdAt: -1 })
      .populate(
        "candidateId",
        "name email trustScore verifiedBadges phoneNumber telegramUsername preferredContactMethod profilePicture"
      )
      .populate("jobId", "title companyId employerId jobType isRemote is_remote");

    return res.status(200).json({
      success: true,
      count: applications.length,
      job: {
        id: job._id,
        title: job.title || "Job",
      },
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch applicants: ${error.message}`,
    });
  }
};

export const getApplicationCvSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id).populate("jobId", "companyId employerId");

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const ownerCompanyId =
      application.companyId || application.jobId?.companyId || application.jobId?.employerId;
    const userRole = req.user?.accountType || req.user?.role;
    const isCandidateOwner = String(application.candidateId) === String(req.user.id);
    const isEmployerOwner = String(ownerCompanyId) === String(req.user.id);

    if (userRole === "candidate" && !isCandidateOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only access your own application CV",
      });
    }

    if (userRole === "employer" && !isEmployerOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only access CVs for your own job posts",
      });
    }

    if (!application.cvSnapshot) {
      return res.status(404).json({
        success: false,
        message: "CV snapshot not available",
      });
    }

    const rawSnapshot =
      typeof application.cvSnapshot?.toObject === "function"
        ? application.cvSnapshot.toObject()
        : application.cvSnapshot;

    return res.status(200).json({
      success: true,
      cvSnapshotUrl: application.cvSnapshotUrl || `/api/applications/${application._id}/cv-snapshot`,
      cvSnapshot: {
        ...(rawSnapshot || {}),
        isVerified: isEmployerOwner ? true : Boolean(rawSnapshot?.isVerified),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch CV snapshot: ${error.message}`,
    });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const requestedStatus = String(status || "").toLowerCase();
    const nextStatus =
      requestedStatus === "accepted" || requestedStatus === "hired"
        ? "contracted"
        : requestedStatus;

    if (!["contracted", "rejected"].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either Accepted/Hired (contracted) or Rejected",
      });
    }

    const application = await Application.findById(id)
      .populate("jobId", "title salary location employerId companyId status vacancies hiredCount hiringLimit")
      .populate("candidateId", "name email");

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const ownerCompanyId =
      application.companyId ||
      application.jobId?.companyId ||
      application.jobId?.employerId;

    if (!ownerCompanyId) {
      return res.status(400).json({
        success: false,
        message: "Application is missing companyId",
      });
    }

    if (String(ownerCompanyId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only manage applications for your own jobs",
      });
    }

    if (application.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed applications cannot be updated",
      });
    }

    const jobId = application.jobId?._id || application.jobId;
    const jobVacancies = Math.max(
      1,
      Number(application.jobId?.vacancies ?? application.jobId?.hiringLimit) || 1
    );
    const currentJobHiredCount = Math.max(0, Number(application.jobId?.hiredCount || 0));
    const currentStatus = String(application.status || "").toLowerCase();
    const isAlreadyCounted = HIRE_COUNTED_STATUSES.includes(currentStatus);
    const isNextCounted = HIRE_COUNTED_STATUSES.includes(nextStatus);
    if (
      nextStatus === "contracted" &&
      !isAlreadyCounted &&
      currentJobHiredCount >= jobVacancies
    ) {
      return res.status(400).json({
        success: false,
        message: "This job has no remaining openings",
      });
    }

    // Always sync companyId to the authenticated employer for strict multi-tenant isolation.
    application.companyId = req.user.id;

    application.status = nextStatus;
    await application.save();
    const hiringProgress = await syncJobHiringProgress({
      jobId,
      employerId: req.user.id,
      notifyOnClose: isNextCounted,
    });
    await createAndEmitNotification({
      recipientId: application.candidateId?._id || application.candidateId,
      senderId: req.user.id,
      senderName: req.user.companyName || req.user.name || "Employer",
      senderProfilePic: req.user.companyLogo || req.user.profilePicture || "",
      type: nextStatus === "contracted" ? "job_accepted" : "job_rejected",
      message:
        nextStatus === "contracted"
          ? `Your application for ${application.jobId?.title || "a job"} was accepted.`
          : `Your application for ${application.jobId?.title || "a job"} was rejected.`,
      metadata: {
        applicationId: application._id,
        jobId,
        jobTitle: application.jobId?.title || "",
        status: nextStatus,
        hiredCount: hiringProgress.job?.hiredCount ?? currentJobHiredCount,
        vacancies: hiringProgress.job?.vacancies ?? jobVacancies,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Application ${nextStatus}`,
      application,
      job: hiringProgress.job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update application status: ${error.message}`,
    });
  }
};

export const getMyApplications = getCandidateApplications;

export const updateApplicationInterviewDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id).populate(
      "jobId",
      "title companyId employerId jobType isRemote is_remote location"
    );

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const ownerCompanyId =
      application.companyId || application.jobId?.companyId || application.jobId?.employerId;
    if (String(ownerCompanyId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only update interview details for your own jobs",
      });
    }

    const isRemoteJob = isRemoteJobRecord(application.jobId);

    const location = String(req.body?.location || "").trim();
    const meetingLink = String(req.body?.meetingLink || "").trim();
    const interviewDate = String(req.body?.interviewDate || "").trim();
    const interviewTime = String(req.body?.interviewTime || "").trim();

    if (!interviewDate) {
      return res.status(400).json({
        success: false,
        message: "Interview date is required",
      });
    }

    if (!interviewTime) {
      return res.status(400).json({
        success: false,
        message: "Interview time is required",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(`${interviewDate}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Interview date is invalid",
      });
    }
    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Interview date cannot be in the past",
      });
    }

    const interviewStartAt = getInterviewStartAt(interviewDate, interviewTime);
    if (!interviewStartAt) {
      return res.status(400).json({
        success: false,
        message: "Interview time is invalid",
      });
    }
    if (interviewStartAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Interview date and time cannot be in the past",
      });
    }

    const interviewDateTime = formatInterviewDateTime(interviewDate, interviewTime);

    if (isRemoteJob) {
      if (!meetingLink) {
        return res.status(400).json({
          success: false,
          message: "Meeting link is required for remote jobs",
        });
      }
      application.interviewDetails = {
        location: "",
        meetingLink,
        interviewDate,
        interviewTime,
      };
    } else {
      if (!location) {
        return res.status(400).json({
          success: false,
          message: "Location is required for on-site jobs",
        });
      }
      application.interviewDetails = {
        location,
        meetingLink: "",
        interviewDate,
        interviewTime,
      };
    }

    await application.save();
    await createAndEmitNotification({
      recipientId: application.candidateId,
      senderId: req.user.id,
      senderName: req.user.companyName || req.user.name || "Employer",
      senderProfilePic: req.user.companyLogo || req.user.profilePicture || "",
      type: "job_interview_scheduled",
      message: `Interview scheduled for ${application.jobId?.title || "your application"} on ${interviewDateTime}.`,
      metadata: {
        applicationId: application._id,
        jobId: application.jobId?._id || application.jobId,
        jobTitle: application.jobId?.title || "",
        interviewDate,
        interviewTime,
        interviewDateTime,
        interviewStartAt: interviewStartAt.toISOString(),
        mode: isRemoteJob ? "remote" : "onsite",
        companyName: req.user.companyName || req.user.name || "",
        interviewLink: isRemoteJob ? meetingLink : "",
        meetingLink: isRemoteJob ? meetingLink : "",
        location: isRemoteJob ? "" : location,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Interview details updated",
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to update interview details: ${error.message}`,
    });
  }
};

export const getCandidateReviews = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const reviews = await CandidateReview.find({ candidateId })
      .sort({ createdAt: -1 })
      .populate("employerId", "name companyName")
      .populate("jobId", "title");

    const total = reviews.length;
    const averageRating = total
      ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total).toFixed(1))
      : 0;

    return res.status(200).json({
      success: true,
      count: total,
      averageRating,
      reviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to fetch candidate reviews: ${error.message}`,
    });
  }
};

export const createCandidateReview = async (req, res) => {
  try {
    const { applicationId, rating, comment } = req.body;
    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: "applicationId is required",
      });
    }

    const result = await saveCandidateReviewForApplication({
      applicationId,
      rating,
      comment,
      employerId: req.user.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to save candidate review",
    });
  }
};

export const completeHandshake = async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id).populate(
      "jobId",
      "location title companyId employerId jobType isRemote is_remote"
    );
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    if (String(application.candidateId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "Not allowed for this application" });
    }

    if (application.status === "completed" || application.handshakeCompleted) {
      const currentUser = await User.findById(req.user.id).select("trustScore profilePicture name");
      return res.status(200).json({
        success: true,
        message: "Handshake already completed",
        application,
        trustScore: currentUser?.trustScore ?? 0,
      });
    }

    if (application.status === "awaiting_confirmation") {
      return res.status(200).json({
        success: true,
        message: "Arrival already submitted. Waiting for employer confirmation.",
        application,
      });
    }

    if (!["accepted", "contracted"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: "Application must be contracted before completion",
      });
    }

    const isRemoteJob = isRemoteJobRecord(application.jobId);

    const ownerCompanyId =
      application.companyId || application.jobId?.companyId || application.jobId?.employerId;
    if (!ownerCompanyId) {
      return res.status(400).json({
        success: false,
        message: "Application is missing companyId",
      });
    }

    application.status = "awaiting_confirmation";
    application.companyId = ownerCompanyId;
    application.arrivalRequestedAt = new Date();
    application.handshakeCompleted = false;
    await application.save();

    await createAndEmitNotification({
      recipientId: ownerCompanyId,
      senderId: req.user.id,
      senderName: req.user.name || "Candidate",
      senderProfilePic: req.user.profilePicture || "",
      type: "arrival_submitted",
      message: isRemoteJob
        ? `${req.user.name || "Candidate"} confirmed remote start for ${application.jobId?.title || "a job"}.`
        : `${req.user.name || "Candidate"} marked arrived for ${application.jobId?.title || "a job"}.`,
      metadata: {
        applicationId: application._id,
        jobId: application.jobId?._id || application.jobId,
        jobTitle: application.jobId?.title || "",
        candidateName: req.user.name || "",
        quickAction: "confirm_arrival",
        mode: isRemoteJob ? "remote" : "onsite",
      },
    });

    return res.status(200).json({
      success: true,
      message: isRemoteJob
        ? "Remote start confirmed. Waiting for employer confirmation."
        : "Arrival submitted. Awaiting employer confirmation.",
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to complete handshake: ${error.message}`,
    });
  }
};

export const confirmCandidateArrival = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id).populate(
      "jobId",
      "title companyId employerId jobType isRemote is_remote"
    );
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const ownerCompanyId =
      application.companyId || application.jobId?.companyId || application.jobId?.employerId;
    if (String(ownerCompanyId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only confirm arrivals for your own jobs",
      });
    }

    if (application.status !== "awaiting_confirmation") {
      return res.status(400).json({
        success: false,
        message: "Application is not waiting for confirmation",
      });
    }

    const isRemoteJob = isRemoteJobRecord(application.jobId);

    application.companyId = req.user.id;
    application.status = "completed";
    application.handshakeCompleted = true;
    application.handshakeAt = new Date();
    await application.save();
    await syncJobHiringProgress({
      jobId: application.jobId?._id || application.jobId,
      employerId: req.user.id,
      notifyOnClose: false,
    });

    const updatedUser = await User.findById(application.candidateId).select(
      "trustScore name profilePicture history verifiedApplicationsCount"
    );

    if (updatedUser) {
      updatedUser.trustScore = applyTrustDelta(updatedUser.trustScore, TRUST_SCORE_INCREMENT);
      if (!updatedUser.history?.some((entry) => String(entry) === String(application._id))) {
        updatedUser.history = [...(updatedUser.history || []), application._id];
      }
      // Keep verified applications aligned with the completed, verified history set.
      updatedUser.verifiedApplicationsCount = Math.max(
        Number(updatedUser.verifiedApplicationsCount || 0),
        Array.isArray(updatedUser.history) ? updatedUser.history.length : 0
      );
      await updatedUser.save();
    }

    await createAndEmitNotification({
      recipientId: application.candidateId,
      senderId: req.user.id,
      senderName: req.user.companyName || req.user.name || "Employer",
      senderProfilePic: req.user.companyLogo || req.user.profilePicture || "",
      type: "arrival_confirmed",
      message: isRemoteJob
        ? `Your remote start was confirmed for ${application.jobId?.title || "a job"}. Trust +10.`
        : `Your arrival was confirmed for ${application.jobId?.title || "a job"}. Trust +10.`,
      metadata: {
        applicationId: application._id,
        jobId: application.jobId?._id || application.jobId,
        jobTitle: application.jobId?.title || "",
        mode: isRemoteJob ? "remote" : "onsite",
      },
    });

    return res.status(200).json({
      success: true,
      message: isRemoteJob ? "Candidate remote start confirmed" : "Candidate arrival confirmed",
      application,
      trustScore: updatedUser?.trustScore ?? 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to confirm candidate arrival: ${error.message}`,
    });
  }
};

export const reportNoShow = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id).populate(
      "jobId",
      "title companyId employerId"
    );
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const ownerCompanyId =
      application.companyId || application.jobId?.companyId || application.jobId?.employerId;
    if (String(ownerCompanyId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only report no-show for your own jobs",
      });
    }

    if (application.status !== "awaiting_confirmation") {
      return res.status(400).json({
        success: false,
        message: "Application is not waiting for confirmation",
      });
    }

    application.companyId = req.user.id;
    application.status = "no_show";
    application.handshakeCompleted = false;
    await application.save();
    await syncJobHiringProgress({
      jobId: application.jobId?._id || application.jobId,
      employerId: req.user.id,
      notifyOnClose: false,
    });

    const candidate = await User.findById(application.candidateId).select(
      "trustScore verifiedApplicationsCount history"
    );
    if (candidate) {
      candidate.trustScore = applyTrustDelta(candidate.trustScore, -TRUST_SCORE_DECREMENT);
      candidate.verifiedApplicationsCount = Math.max(
        0,
        Number(candidate.verifiedApplicationsCount || 0)
      );
      await candidate.save();
    }

    await createAndEmitNotification({
      recipientId: application.candidateId,
      senderId: req.user.id,
      senderName: req.user.companyName || req.user.name || "Employer",
      senderProfilePic: req.user.companyLogo || req.user.profilePicture || "",
      type: "no_show_reported",
      message: `Your arrival was reported as no-show for ${application.jobId?.title || "a job"}. Trust -20.`,
      metadata: {
        applicationId: application._id,
        jobId: application.jobId?._id || application.jobId,
        jobTitle: application.jobId?.title || "",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Candidate reported as no-show",
      application,
      trustScore: candidate?.trustScore ?? 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to report no-show: ${error.message}`,
    });
  }
};

const applicationIdFromString = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
};

const saveCandidateReviewForApplication = async ({
  applicationId,
  rating,
  comment,
  employerId,
}) => {
  const normalizedRating = Number(rating);
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    const error = new Error("Rating must be a number between 1 and 5");
    error.statusCode = 400;
    throw error;
  }

  const application = await Application.findById(applicationId).populate("jobId", "companyId employerId");
  if (!application) {
    const error = new Error("Application not found");
    error.statusCode = 404;
    throw error;
  }

  if (application.status !== "completed") {
    const error = new Error("Candidate can only be reviewed after the application is completed");
    error.statusCode = 400;
    throw error;
  }

  const ownerCompanyId =
    application.companyId || application.jobId?.companyId || application.jobId?.employerId;

  if (String(ownerCompanyId) !== String(employerId)) {
    const error = new Error("Forbidden: you can only review candidates for your own company");
    error.statusCode = 403;
    throw error;
  }

  const reviewFilter = {
    candidateId: application.candidateId,
    companyId: ownerCompanyId,
    jobId: application.jobId?._id || application.jobId,
  };

  const existingReview = await CandidateReview.findOne(reviewFilter);
  const oldRating = Number(existingReview?.rating || 0);

  const review = await CandidateReview.findOneAndUpdate(
    reviewFilter,
    {
      $set: {
        employerId,
        rating: normalizedRating,
        comment: String(comment || "").trim(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const previousDelta = REVIEW_TRUST_SCORE_DELTA_BY_RATING[oldRating] || 0;
  const nextDelta = REVIEW_TRUST_SCORE_DELTA_BY_RATING[normalizedRating] || 0;
  const trustDeltaToApply = nextDelta - previousDelta;

  const candidate = await User.findById(application.candidateId).select(
    "trustScore verifiedApplicationsCount history"
  );
  if (!candidate) {
    const error = new Error("Candidate not found");
    error.statusCode = 404;
    throw error;
  }

  candidate.trustScore = applyTrustDelta(candidate.trustScore, trustDeltaToApply);

  if (!candidate.history?.some((entry) => String(entry) === String(application._id))) {
    candidate.history = [...(candidate.history || []), application._id];
  }
  candidate.verifiedApplicationsCount = Math.max(
    Number(candidate.verifiedApplicationsCount || 0),
    Array.isArray(candidate.history) ? candidate.history.length : 0
  );
  candidate.trustScore = clampTrustScore(candidate.trustScore);

  await candidate.save();

  return {
    success: true,
    message: "Candidate reviewed! Trust Score updated.",
    review,
    trustScore: candidate.trustScore,
    verifiedApplicationsCount: candidate.verifiedApplicationsCount,
  };
};
