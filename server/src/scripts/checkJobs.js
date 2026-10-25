import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import Job from "../models/Job.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const visibleJobFilter = {
  $or: [{ status: "open" }, { status: { $exists: false } }, { status: null }],
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const [total, visible, byStatus, byCategory, latest] = await Promise.all([
    Job.countDocuments({}),
    Job.countDocuments(visibleJobFilter),
    Job.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Job.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Job.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title category status createdAt companyProfile.companyName"),
  ]);

  console.log(
    JSON.stringify(
      {
        database: mongoose.connection.name,
        collection: Job.collection.name,
        totalJobs: total,
        jobsVisibleToFeed: visible,
        hiddenByFeedFilter: total - visible,
        byStatus,
        topCategories: byCategory,
        latestJobs: latest,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
