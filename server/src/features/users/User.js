import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["candidate", "employer"] },
    accountType: {
      type: String,
      enum: ["candidate", "employer"],
      required: true,
    },
    trustScore: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verifiedBadges: [{ type: String }],
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
    preferredLanguage: { type: String, default: "km" },
    companyName: { type: String, trim: true },
    companyLogo: { type: String, trim: true },
    companyCoverPicture: { type: String, trim: true },
    companyWebsite: { type: String, trim: true },
    companyAddress: { type: String, trim: true, maxlength: 220 },
    companySize: { type: String, trim: true, maxlength: 80 },
    companyLocation: {
      address: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number },
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
    companyLocationBonusGranted: { type: Boolean, default: false },
    businessRegistration: { type: String, trim: true },
    companyDescription: { type: String, trim: true, maxlength: 500 },
    businessPhoneNumber: { type: String, trim: true },
    businessTelegramUsername: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    telegramUsername: { type: String, trim: true },
    profilePicture: { type: String, trim: true },
    profileCompletionBonusGranted: { type: Boolean, default: false },
    preferredContactMethod: {
      type: String,
      enum: ["phone", "telegram", "none"],
      default: "none",
    },
    bio: { type: String, maxlength: 200 },
    university: { type: String, trim: true, maxlength: 120 },
    school: { type: String, trim: true, maxlength: 120 },
    skills: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true, maxlength: 60 }],
    educationHistory: [{ type: String, trim: true, maxlength: 140 }],
    workExperience: [
      {
        jobTitle: { type: String, trim: true, maxlength: 120 },
        bulletPoints: [{ type: String, trim: true, maxlength: 220 }],
        startDate: { type: String, trim: true, maxlength: 20 },
        endDate: { type: String, trim: true, maxlength: 20 },
      },
    ],
    preferredCategory: { type: String, trim: true },
    preferredCategories: [{ type: String, trim: true }],
    preferredLocation: { type: String, trim: true },
    isFirstLogin: { type: Boolean, default: true },
    history: [{ type: Schema.Types.ObjectId, ref: "Application" }],
    verifiedApplicationsCount: { type: Number, default: 0 },
    savedJobs: [{ type: Schema.Types.ObjectId, ref: "Job" }],
    rating: { type: Number, default: 5.0 },
    onboardingComplete: { type: Boolean, default: false },
    adminRole: {
      type: String,
      enum: ["none", "moderator", "super_admin"],
      default: "none",
      index: true,
    },
  },
  { timestamps: true }
);

userSchema.index({ "location.geo": "2dsphere" });
userSchema.index({ "companyLocation.geo": "2dsphere" });

const User = model("User", userSchema);

export default User;
