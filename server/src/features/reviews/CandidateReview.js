import mongoose from "mongoose";

const { Schema, model } = mongoose;

const candidateReviewSchema = new Schema(
  {
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

candidateReviewSchema.index({ candidateId: 1, companyId: 1, jobId: 1 }, { unique: true });

const CandidateReview = model("CandidateReview", candidateReviewSchema);

export default CandidateReview;
