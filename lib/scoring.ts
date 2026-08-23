import type { ConfidenceLabel, GrokInvestigation, Recommendation, RiskScores } from "./types.ts";
import { clamp, roundScore } from "./utils.ts";

export const METHODOLOGY_VERSION = "vg-2026.08.2";

export function isNeutralMetricVector(investigation: GrokInvestigation): boolean {
  const values = Object.values(investigation.metrics);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return max - min <= 2 && mean >= 48 && mean <= 52;
}

export function calculateRiskScores(investigation: GrokInvestigation): RiskScores {
  const m = investigation.metrics;

  const authenticity = roundScore(
    m.contentOriginality * 0.26 +
      m.identityContinuity * 0.24 +
      m.engagementQuality * 0.18 +
      m.socialDiversity * 0.14 +
      (100 - m.automationPattern) * 0.1 +
      (100 - m.campaignConcentration) * 0.08,
  );

  const farmerRisk = roundScore(
    m.campaignConcentration * 0.36 +
      m.reciprocityPressure * 0.28 +
      (100 - m.contentOriginality) * 0.14 +
      (100 - m.socialDiversity) * 0.08 +
      m.networkCoordination * 0.14,
  );

  const botRisk = roundScore(
    m.automationPattern * 0.46 +
      m.temporalAnomalies * 0.24 +
      (100 - m.contentOriginality) * 0.14 +
      (100 - m.engagementQuality) * 0.16,
  );

  const sybilRisk = roundScore(
    m.networkCoordination * 0.42 +
      (100 - m.socialDiversity) * 0.18 +
      m.automationPattern * 0.14 +
      m.reciprocityPressure * 0.16 +
      m.campaignConcentration * 0.1,
  );

  const vouchConfidence = roundScore(
    authenticity * 0.62 +
      (100 - farmerRisk) * 0.16 +
      (100 - botRisk) * 0.1 +
      (100 - sybilRisk) * 0.12,
  );

  return { authenticity, farmerRisk, botRisk, sybilRisk, vouchConfidence };
}

export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.78) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function recommendationFor(scores: RiskScores, confidence: number): Recommendation {
  if (confidence < 0.45) return "SKIP";

  if (
    confidence >= 0.68 &&
    scores.vouchConfidence >= 76 &&
    scores.authenticity >= 70 &&
    scores.botRisk < 55 &&
    scores.sybilRisk < 58
  ) {
    return "VOUCH";
  }

  if (
    confidence >= 0.72 &&
    scores.vouchConfidence <= 36 &&
    ((scores.botRisk >= 72 && scores.sybilRisk >= 58) || scores.sybilRisk >= 78)
  ) {
    return "REVIEW_SLASH";
  }

  return "SKIP";
}

export function normalizeConfidence(value: number): number {
  return clamp(value, 0, 1);
}
