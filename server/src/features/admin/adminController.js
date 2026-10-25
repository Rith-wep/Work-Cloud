import CatalogTerm from "../users/CatalogTerm.js";
import AuditLog from "./AuditLog.js";
import Application from "../applications/Application.js";
import Job from "../jobs/Job.js";
import User from "../users/User.js";
import { recordAdminAuditLog } from "../../shared/utils/auditLog.js";
import { mergeCatalogTerms } from "../../shared/utils/catalogCleanup.js";

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || process.env.AI_API_BASE_URL_INTERNAL || "http://localhost:8000";

const heuristicSuggestions = (terms = []) => {
  const normalized = (Array.isArray(terms) ? terms : [])
    .map((term) => ({
      key: String(term?.key || "").trim(),
      label: String(term?.label || term?.key || "").trim(),
      kind: String(term?.kind || "").trim(),
    }))
    .filter((term) => term.key);

  const aliasMap = {
    js: "javascript",
    javascript: "javascript",
    java_script: "javascript",
    nodejs: "node_js",
    "node.js": "node_js",
  };

  const groups = new Map();
  normalized.forEach((term) => {
    const canonical = aliasMap[term.key] || term.key;
    if (!groups.has(canonical)) {
      groups.set(canonical, []);
    }
    groups.get(canonical).push(term);
  });

  return Array.from(groups.entries())
    .filter(([, members]) => members.length > 1)
    .map(([primaryKey, members]) => ({
      kind: members[0]?.kind || "skill",
      primaryKey,
      primaryLabel: members[0]?.label || primaryKey,
      members: members.map((item) => ({ key: item.key, label: item.label })),
      reason: "Heuristic match based on common aliases and normalized wording.",
    }));
};


export const getCatalogDashboard = async (_req, res) => {
  try {
    const terms = await CatalogTerm.find({})
      .sort({ kind: 1, usageCount: -1, label: 1 })
      .select("kind key label usageCount createdAt updatedAt")
      .lean();

    await recordAdminAuditLog({
      req: _req,
      action: "view",
      resourceType: "catalog_term",
      resourceId: `catalog:${terms.length}`,
      targetIds: terms.map((term) => term._id).slice(0, 100),
      metadata: { count: terms.length },
    });

    return res.status(200).json({
      success: true,
      terms,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load catalog dashboard: ${error.message}`,
    });
  }
};

export const mergeCatalogDashboardTerms = async (req, res) => {
  try {
    const { kind, sourceKeys, targetKey, safeMode = true } = req.body || {};

    if (safeMode) {
      return res.status(200).json({
        success: true,
        preview: true,
        message: "Safe Mode is enabled. Disable it to perform the merge.",
      });
    }

    const merged = await mergeCatalogTerms({ kind, sourceKeys, targetKey });
    await recordAdminAuditLog({
      req,
      action: "edit",
      resourceType: "catalog_term",
      resourceId: String(targetKey || "").trim(),
      targetIds: Array.isArray(sourceKeys) ? sourceKeys : [],
      metadata: {
        kind,
        targetKey,
        sourceKeys: Array.isArray(sourceKeys) ? sourceKeys : [],
      },
    });
    return res.status(200).json({
      success: true,
      message: "Catalog terms merged successfully",
      mergedTerm: merged,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to merge catalog terms",
    });
  }
};

export const getCatalogAiMergeSuggestions = async (_req, res) => {
  try {
    const terms = await CatalogTerm.find({})
      .sort({ kind: 1, usageCount: -1, label: 1 })
      .select("kind key label usageCount")
      .lean();

    let suggestions = [];
    try {
      const response = await fetch(`${AI_API_BASE_URL}/api/ai/catalog-merge-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "AI suggestion failed");
      }
      suggestions = Array.isArray(data?.groups) ? data.groups : [];
    } catch {
      suggestions = heuristicSuggestions(terms);
    }

    await recordAdminAuditLog({
      req: _req,
      action: "view",
      resourceType: "catalog_merge_suggestion",
      resourceId: `suggestions:${suggestions.length}`,
      metadata: {
        termCount: terms.length,
        suggestionCount: suggestions.length,
      },
    });

    return res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load AI merge suggestions: ${error.message}`,
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || "").trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    // demo
    const sortFeild = String(req.query.sortFeild || "").trim();


    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "name email accountType role adminRole trustScore isVerified companyName phoneNumber preferredCategory preferredCategories createdAt updatedAt"
        )
        .lean(),
      User.countDocuments(filter),
    ]);

    await recordAdminAuditLog({
      req,
      action: "view",
      resourceType: "user",
      resourceId: `page:${page}`,
      targetIds: users.map((user) => user._id),
      metadata: { page, limit, total, search },
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load users: ${error.message}`,
    });
  }
};

export const getAllJobs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || "").trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { "companyProfile.companyName": { $regex: search, $options: "i" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          "title category status salary companyId employerId companyProfile.companyName requiredSkills vacancies hiredCount metadata.applyCount views createdAt updatedAt"
        )
        .lean(),
      Job.countDocuments(filter),
    ]);

    await recordAdminAuditLog({
      req,
      action: "view",
      resourceType: "job",
      resourceId: `page:${page}`,
      targetIds: jobs.map((job) => job._id),
      metadata: { page, limit, total, search },
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      jobs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load jobs: ${error.message}`,
    });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalCandidates,
      totalEmployers,
      totalModerators,
      totalSuperAdmins,
      totalJobs,
      openJobs,
      totalApplications,
      successfulMatches,
      totalVacanciesAgg,
      totalHiresAgg,
      fullyStaffedJobs,
      totalCatalogTerms,
      totalAuditLogs,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ accountType: "candidate" }),
      User.countDocuments({ accountType: "employer" }),
      User.countDocuments({ adminRole: "moderator" }),
      User.countDocuments({ adminRole: "super_admin" }),
      Job.countDocuments({}),
      Job.countDocuments({ status: "open" }),
      Application.countDocuments({}),
      Application.countDocuments({
        status: { $in: ["accepted", "contracted", "awaiting_confirmation", "completed"] },
      }),
      Job.aggregate([
        {
          $group: {
            _id: null,
            totalVacancies: {
              $sum: {
                $max: [{ $ifNull: ["$vacancies", "$hiringLimit"] }, 1],
              },
            },
          },
        },
      ]),
      Job.aggregate([
        {
          $group: {
            _id: null,
            totalHires: { $sum: { $max: [{ $ifNull: ["$hiredCount", 0] }, 0] } },
          },
        },
      ]),
      Job.countDocuments({
        $expr: {
          $gte: [
            { $ifNull: ["$hiredCount", 0] },
            { $max: [{ $ifNull: ["$vacancies", "$hiringLimit"] }, 1] },
          ],
        },
      }),
      CatalogTerm.countDocuments({}),
      AuditLog.countDocuments({}),
    ]);

    const matchingSuccessRate =
      totalApplications > 0 ? Math.round((successfulMatches / totalApplications) * 100) : 0;
    const totalVacancies = Number(totalVacanciesAgg?.[0]?.totalVacancies || 0);
    const totalHires = Number(totalHiresAgg?.[0]?.totalHires || 0);
    const recruitmentFillRate =
      totalVacancies > 0 ? Math.round((totalHires / totalVacancies) * 100) : 0;

    const stats = {
      users: {
        total: totalUsers,
        candidates: totalCandidates,
        employers: totalEmployers,
      },
      adminAccess: {
        moderators: totalModerators,
        superAdmins: totalSuperAdmins,
      },
      jobs: {
        total: totalJobs,
        open: openJobs,
        totalVacancies,
        totalHires,
        fullyStaffed: fullyStaffedJobs,
        recruitmentFillRate,
      },
      applications: {
        total: totalApplications,
        successfulMatches,
        matchingSuccessRate,
      },
      catalog: {
        totalTerms: totalCatalogTerms,
      },
      audit: {
        totalLogs: totalAuditLogs,
      },
    };

    await recordAdminAuditLog({
      req,
      action: "view",
      resourceType: "admin_stats",
      resourceId: "platform-overview",
      metadata: stats,
    });

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load admin stats: ${error.message}`,
    });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

    const [logs, total] = await Promise.all([
      AuditLog.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments({}),
    ]);

    await recordAdminAuditLog({
      req,
      action: "view",
      resourceType: "audit_log",
      resourceId: `page:${page}`,
      metadata: { page, limit, total },
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Failed to load audit logs: ${error.message}`,
    });
  }
};
