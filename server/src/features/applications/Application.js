import mongoose from "mongoose";

const { Schema, model } = mongoose;

const applicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "contracted",
        "awaiting_confirmation",
        "rejected",
        "no_show",
        "completed",
      ],
      default: "pending",
    },
    handshakeCompleted: { type: Boolean, default: false },
    appliedAt: { type: Date, default: Date.now },
    arrivalRequestedAt: { type: Date },
    handshakeAt: { type: Date },
    interviewDetails: {
      location: { type: String, trim: true },
      meetingLink: { type: String, trim: true },
      interviewDate: { type: String, trim: true },
      interviewTime: { type: String, trim: true },
    },
    cvSnapshotUrl: { type: String, trim: true },
    cvSnapshot: {
      type: {
        fullName: { type: String, trim: true },
        headline: { type: String, trim: true },
        summary: { type: String, trim: true },
        profilePicture: { type: String, trim: true },
        contact: {
          phone: { type: String, trim: true },
          email: { type: String, trim: true },
          telegram: { type: String, trim: true },
        },
        skills: [{ type: String, trim: true }],
        languages: [{ type: String, trim: true }],
        experiences: [
          {
            title: { type: String, trim: true },
            dateRange: { type: String, trim: true },
            bullets: [{ type: String, trim: true }],
          },
        ],
        education: [
          {
            title: { type: String, trim: true },
            dateRange: { type: String, trim: true },
          },
        ],
        isVerified: { type: Boolean, default: false },
        generatedAt: { type: Date, default: Date.now },
      },
      default: null,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

const Application = model("Application", applicationSchema);

export default Application;
