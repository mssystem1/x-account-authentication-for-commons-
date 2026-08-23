import assert from "node:assert/strict";
import test from "node:test";
import { calculateRiskScores, isNeutralMetricVector, recommendationFor } from "../lib/scoring.ts";
import type { GrokInvestigation } from "../lib/types.ts";

function investigation(metrics: GrokInvestigation["metrics"], confidence = 0.9): GrokInvestigation {
  return {
    profile: { handle: "test", displayName: "Test", bioSummary: "", accountHistory: "", activitySummary: "" },
    coverage: { profileResolved: true, postsObserved: 40, distinctDaysObserved: 15, sufficiency: "sufficient", note: "Good coverage" },
    metrics,
    evidence: [],
    summary: "",
    confidence,
    uncertainties: [],
  };
}

test("clean account receives high vouch confidence", () => {
  const scores = calculateRiskScores(investigation({ contentOriginality: 92, identityContinuity: 90, engagementQuality: 86, socialDiversity: 88, campaignConcentration: 12, reciprocityPressure: 8, automationPattern: 6, temporalAnomalies: 7, networkCoordination: 9 }));
  assert.ok(scores.authenticity >= 85);
  assert.ok(scores.vouchConfidence >= 80);
  assert.equal(recommendationFor(scores, 0.9), "VOUCH");
});

test("coordinated automated account is sent to slash review", () => {
  const scores = calculateRiskScores(investigation({ contentOriginality: 15, identityContinuity: 31, engagementQuality: 20, socialDiversity: 16, campaignConcentration: 86, reciprocityPressure: 91, automationPattern: 93, temporalAnomalies: 88, networkCoordination: 95 }));
  assert.ok(scores.botRisk >= 75);
  assert.ok(scores.sybilRisk >= 75);
  assert.equal(recommendationFor(scores, 0.92), "REVIEW_SLASH");
});

test("low confidence never becomes a strong action recommendation", () => {
  const scores = { authenticity: 95, farmerRisk: 5, botRisk: 3, sybilRisk: 4, vouchConfidence: 96 };
  assert.equal(recommendationFor(scores, 0.3), "SKIP");
});

test("detects an all-neutral placeholder vector", () => {
  const neutral = investigation({ contentOriginality: 50, identityContinuity: 50, engagementQuality: 50, socialDiversity: 50, campaignConcentration: 50, reciprocityPressure: 50, automationPattern: 50, temporalAnomalies: 50, networkCoordination: 50 });
  assert.equal(isNeutralMetricVector(neutral), true);
});
