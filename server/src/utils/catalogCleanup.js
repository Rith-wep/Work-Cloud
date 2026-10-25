import CatalogTerm from "../models/CatalogTerm.js";
import User from "../models/User.js";
import Job from "../models/Job.js";

const DEFAULT_DUPLICATE_MAP = {
  js: "javascript",
  javascript: "javascript",
  java_script: "javascript",
  nodejs: "node_js",
  "node.js": "node_js",
  uiux: "ui_ux",
  "ui ux": "ui_ux",
  bioengineering: "bio_engineering",
};

export const mergeDuplicateCatalogTerms = async (duplicateMap = DEFAULT_DUPLICATE_MAP) => {
  const entries = Object.entries(duplicateMap).filter(([source, target]) => source && target && source !== target);

  for (const [sourceKey, targetKey] of entries) {
    const source = String(sourceKey).trim();
    const target = String(targetKey).trim();
    if (!source || !target || source === target) {
      continue;
    }

    const sourceTerm = await CatalogTerm.findOne({ key: source }).lean();
    const kind = sourceTerm?.kind || "skill";

    const targetTerm = await CatalogTerm.findOneAndUpdate(
      { kind, key: target },
      {
        $setOnInsert: {
          kind,
          key: target,
          label: String(target).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        },
        $inc: { usageCount: 1 },
      },
      { upsert: true, new: true }
    );

    await Promise.all([
      User.updateMany({ skills: source }, { $set: { "skills.$[item]": target } }, { arrayFilters: [{ item: source }] }),
      User.updateMany(
        { preferredCategories: source },
        { $set: { "preferredCategories.$[item]": target } },
        { arrayFilters: [{ item: source }] }
      ),
      User.updateMany({ preferredCategory: source }, { $set: { preferredCategory: target } }),
      Job.updateMany({ requiredSkills: source }, { $set: { "requiredSkills.$[item]": target } }, { arrayFilters: [{ item: source }] }),
      Job.updateMany({ category: source }, { $set: { category: target } }),
      CatalogTerm.deleteMany({ kind, key: source }),
    ]);

    if (kind === "category") {
      await CatalogTerm.findOneAndUpdate({ kind: "category", key: target }, { $inc: { usageCount: 1 } }, { new: true });
    }
  }
};

export const mergeCatalogTerms = async ({ kind, sourceKeys = [], targetKey }) => {
  const normalizedKind = String(kind || "").trim();
  const normalizedTargetKey = String(targetKey || "").trim();
  const normalizedSourceKeys = Array.from(
    new Set((Array.isArray(sourceKeys) ? sourceKeys : []).map((entry) => String(entry || "").trim()).filter(Boolean))
  ).filter((entry) => entry !== normalizedTargetKey);

  if (!["skill", "category"].includes(normalizedKind)) {
    throw new Error("kind must be skill or category");
  }
  if (!normalizedTargetKey || normalizedSourceKeys.length < 1) {
    throw new Error("targetKey and at least one sourceKey are required");
  }

  const targetTerm = await CatalogTerm.findOneAndUpdate(
    { kind: normalizedKind, key: normalizedTargetKey },
    {
      $setOnInsert: {
        kind: normalizedKind,
        key: normalizedTargetKey,
        label: String(normalizedTargetKey).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      },
      $inc: { usageCount: normalizedSourceKeys.length },
    },
    { upsert: true, new: true }
  );

  if (normalizedKind === "skill") {
    for (const source of normalizedSourceKeys) {
      await Promise.all([
        User.updateMany({ skills: source }, { $set: { "skills.$[item]": normalizedTargetKey } }, { arrayFilters: [{ item: source }] }),
        Job.updateMany({ requiredSkills: source }, { $set: { "requiredSkills.$[item]": normalizedTargetKey } }, { arrayFilters: [{ item: source }] }),
        CatalogTerm.deleteMany({ kind: "skill", key: source }),
      ]);
    }
  }

  if (normalizedKind === "category") {
    for (const source of normalizedSourceKeys) {
      await Promise.all([
        User.updateMany(
          { preferredCategories: source },
          { $set: { "preferredCategories.$[item]": normalizedTargetKey } },
          { arrayFilters: [{ item: source }] }
        ),
        User.updateMany({ preferredCategory: source }, { $set: { preferredCategory: normalizedTargetKey } }),
        Job.updateMany({ category: source }, { $set: { category: normalizedTargetKey } }),
        CatalogTerm.deleteMany({ kind: "category", key: source }),
      ]);
    }
  }

  return targetTerm;
};

export default mergeDuplicateCatalogTerms;
