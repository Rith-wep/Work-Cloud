export const TRUST_SCORE_MIN = 0;
export const TRUST_SCORE_MAX = 100;

export const clampTrustScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return TRUST_SCORE_MIN;
  }
  return Math.min(TRUST_SCORE_MAX, Math.max(TRUST_SCORE_MIN, numeric));
};

export const applyTrustDelta = (currentScore, delta) =>
  clampTrustScore(Number(currentScore || 0) + Number(delta || 0));
