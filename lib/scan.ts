import { demoInvestigation } from "./demo.ts";
import { calculateRiskScores, confidenceLabel, METHODOLOGY_VERSION, normalizeConfidence, recommendationFor } from "./scoring.ts";
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
  const { investigation, model } = demo
    ? { investigation: demoInvestigation(handle), model: "demo-grok-4.5" }
    : await investigateWithGrok(handle);

  const scores = calculateRiskScores(investigation);
  const confidence = normalizeConfidence(investigation.confidence);
  const recommendation = recommendationFor(scores, confidence);
  const createdAt = new Date().toISOString();
  const sourceUrls = unique(investigation.evidence.flatMap((item) => item.sourceUrls));

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
    summary: investigation.summary,
    profile: investigation.profile,
    evidence: investigation.evidence,
    uncertainties: investigation.uncertainties,
    sourceUrls,
    methodologyVersion: METHODOLOGY_VERSION,
    cached: false,
    permalink: `${appOrigin()}/u/${handle}`,
  };

  await writeCachedScan(result).catch((error) => {
    console.error("VouchGuard cache write failed", error);
  });

  return result;
}
