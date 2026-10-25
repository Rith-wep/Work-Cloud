import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

import connectDB from "../../infrastructure/database/db.js";
import { mergeDuplicateCatalogTerms } from "../utils/catalogCleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const run = async () => {
  try {
    await connectDB();
    await mergeDuplicateCatalogTerms();
    console.log("Catalog merge complete");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Catalog merge failed:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

run();


