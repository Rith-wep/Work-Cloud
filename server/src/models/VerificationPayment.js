import mongoose from "mongoose";

const { Schema, model } = mongoose;

const verificationPaymentSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["aba_payway", "bakong_khqr"],
      default: "bakong_khqr",
    },
    amount: { type: Number, required: true, default: 1 },
    currency: { type: String, trim: true, default: "USD" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    transactionId: { type: String, trim: true, required: true, unique: true },
    providerTransactionId: { type: String, trim: true, default: "" },
    checkoutUrl: { type: String, trim: true, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const VerificationPayment = model("VerificationPayment", verificationPaymentSchema);

export default VerificationPayment;
