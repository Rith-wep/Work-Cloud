import mongoose from "mongoose";

const { Schema, model } = mongoose;

const catalogTermSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["skill", "category"],
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    usageCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

catalogTermSchema.index({ kind: 1, key: 1 }, { unique: true });

const CatalogTerm = model("CatalogTerm", catalogTermSchema);

export default CatalogTerm;
