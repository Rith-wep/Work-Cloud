import User from "../models/User.js";
import { applyTrustDelta } from "./trustScore.js";

const PROFILE_COMPLETION_TRUST_BONUS = 10;

export const applyCandidateProfileBonusIfEligible = async (userId) => {
  const user = await User.findById(userId).select(
    "role accountType bio profilePicture trustScore profileCompletionBonusGranted"
  );
  if (!user) {
    return null;
  }

  const role = user.accountType || user.role;
  const hasBio = Boolean(String(user.bio || "").trim());
  const hasProfilePicture = Boolean(String(user.profilePicture || "").trim());
  const isEligible =
    role === "candidate" &&
    hasBio &&
    hasProfilePicture &&
    !Boolean(user.profileCompletionBonusGranted);

  if (!isEligible) {
    return user;
  }

  user.trustScore = applyTrustDelta(user.trustScore, PROFILE_COMPLETION_TRUST_BONUS);
  user.profileCompletionBonusGranted = true;
  await user.save();

  return user;
};

const LOCATION_VERIFICATION_TRUST_BONUS = 10;

export const applyEmployerLocationBonusIfEligible = async (userId) => {
  const user = await User.findById(userId).select(
    "role accountType trustScore companyLocation companyLocationBonusGranted"
  );
  if (!user) {
    return null;
  }

  const role = user.accountType || user.role;
  const lat = Number(user?.companyLocation?.lat);
  const lng = Number(user?.companyLocation?.lng);
  const address = String(user?.companyLocation?.address || "").trim();
  const isEligible =
    role === "employer" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Boolean(address) &&
    !Boolean(user.companyLocationBonusGranted);

  if (!isEligible) {
    return user;
  }

  user.trustScore = applyTrustDelta(user.trustScore, LOCATION_VERIFICATION_TRUST_BONUS);
  user.companyLocationBonusGranted = true;
  await user.save();

  return user;
};
