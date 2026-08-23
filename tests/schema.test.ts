import assert from "node:assert/strict";
import test from "node:test";
import { parseGrokInvestigation } from "../lib/schema.ts";

test("parser clamps scores and drops unsafe source URLs", () => {
  const parsed = parseGrokInvestigation({ profile: { displayName: "Alice", bioSummary: "Builder", accountHistory: "Long-lived", activitySummary: "Original posts" }, metrics: { contentOriginality: 120, identityContinuity: 80, engagementQuality: 75, socialDiversity: 70, campaignConcentration: -5, reciprocityPressure: 10, automationPattern: 9, temporalAnomalies: 4, networkCoordination: 3 }, evidence: [{ category: "authenticity", label: "Original work", observation: "Several original threads", impact: "positive", severity: 8, confidence: 0.95, sourceUrls: ["https://x.com/alice/status/1", "https://evil.example/a"] }], summary: "Looks consistent", confidence: 1.4, uncertainties: [] }, "alice");
  assert.equal(parsed.metrics.contentOriginality, 100); assert.equal(parsed.metrics.campaignConcentration, 0); assert.equal(parsed.confidence, 1); assert.deepEqual(parsed.evidence[0]?.sourceUrls, ["https://x.com/alice/status/1"]);
});
