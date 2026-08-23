import { demoInvestigation } from "./demo.ts";
import { calculateRiskScores, confidenceLabel, isNeutralMetricVector, METHODOLOGY_VERSION, normalizeConfidence, recommendationFor } from "./scoring.ts";
import { readCachedScan, isFresh, writeCachedScan } from "./storage.ts";
import type { ScanResult } from "./types.ts";
import { appOrigin, normalizeHandle, unique } from "./utils.ts";
import { investigateWithGrok } from "./xai.ts";

export async function scanAccount(input: string, refresh = false): Promise<ScanResult> {
  const handle = normalizeHandle(input);

  if (!refresh) {
    const cached = await readCachedScan(handle);
    if (cached && isFresh(cached)) {
      return { ...cached, cached: true, permalink: `${appOrigin()}/u/${handle}` };
    }
  }

  const demo = process.env.VOUCHGUARD_DEMO_MODE === "true";
  const { investigation, model, xSearchCalls } = demo
    ? { investigation: demoInvestigation(handle), model: "demo-grok-4.5", xSearchCalls: 1 }
    : await investigateWithGrok(handle);

  const neutralVectorDetected = isNeutralMetricVector(investigation);
  const coverage = investigation.coverage;
  const insufficient =
    !coverage.profileResolved ||
    coverage.sufficiency === "insufficient" ||
    coverage.postsObserved < 5 ||
    xSearchCalls < 1 ||
    neutralVectorDetected;

  let confidence = normalizeConfidence(investigation.confidence);
  if (coverage.sufficiency === "limited") confidence = Math.min(confidence, 0.59);
  if (insufficient) confidence = Math.min(confidence, 0.25);

  const scores = insufficient ? null : calculateRiskScores(investigation);
  const recommendation = scores ? recommendationFor(scores, confidence) : "UNSCORABLE";
  const createdAt = new Date().toISOString();
  const sourceUrls = unique(investigation.evidence.flatMap((item) => item.sourceUrls));
  const summary = insufficient
    ? `VouchGuard could not gather enough direct X evidence to score @${handle} reliably. ${coverage.note}`
    : investigation.summary;

  const result: ScanResult = {
    id: `${handle.toLowerCase()}-${Date.now()}`,
    handle,
    createdAt,
    model,
    mode: demo ? "demo" : "live",
    scores,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    recommendation,
    summary,
    profile: investigation.profile,
    coverage,
    diagnostics: {
      xSearchCalls,
      neutralVectorDetected,
    },
    evidence: investigation.evidence,
    uncertainties: investigation.uncertainties,
    sourceUrls,
    methodologyVersion: METHODOLOGY_VERSION,
    cached: false,
    permalink: `${appOrigin()}/u/${handle}`,
  };

  // Never persist an unscorable result. A temporary X Search retrieval failure
  // should be retried on the next scan rather than cached for hours.
  if (scores) {
    await writeCachedScan(result).catch((error) => {
      console.error("VouchGuard cache write failed", error);
    });
  }

  return result;
}
