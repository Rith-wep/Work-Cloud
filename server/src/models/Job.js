import mongoose from "mongoose";

const { Schema, model } = mongoose;

const jobSchema = new Schema(
  {
    title: { type: String, trim: true },
    description: { type: String },
    salary: { type: String },
    employerId: { type: Schema.Types.ObjectId, ref: "User" },
    companyId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyProfile: {
      companyName: { type: String, trim: true },
      companyLogo: { type: String, trim: true },
      companyWebsite: { type: String, trim: true },
      companySize: { type: String, trim: true },
      businessRegistration: { type: String, trim: true },
      companyDescription: { type: String, trim: true },
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
      geo: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
          default: [0, 0],
        },
      },
    },
    isFeatured: { type: Boolean, default: false },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    requiredSkills: [{ type: String }],
    is_remote: { type: Boolean, default: false, index: true },
    tier_level: {
      type: String,
      enum: ["remote", "no_experience", "junior", "senior"],
      default: "junior",
      index: true,
    },
    isRemote: { type: Boolean, default: false },
    experienceLevel: {
      type: String,
      enum: ["entry", "junior", "senior"],
      default: "junior",
    },
    min_experience: { type: Number, default: 1, min: 0 },
    applicants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    vacancies: { type: Number, required: true, min: 1, default: 1 },
    hiredCount: { type: Number, default: 0, min: 0 },
    hiringLimit: { type: Number, default: 1, min: 1 },
    views: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "closed", "archived"], default: "open" },
    jobType: {
      type: String,
      enum: ["gig", "full-time", "part-time"],
    },
    urgency: {
      type: String,
      enum: ["high", "medium", "low"],
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid_online", "cash_on_site"],
      default: "unpaid",
    },
    metadata: {
      views: { type: Number, default: 0 },
      applyCount: { type: Number, default: 0 },
      ai_indexed_at: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

jobSchema.index({ "location.geo": "2dsphere" });

const Job = model("Job", jobSchema);

export default Job;
