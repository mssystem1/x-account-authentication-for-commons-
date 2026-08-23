import type { EvidenceItem, GrokInvestigation, GrokMetrics } from "./types.ts";
import { clamp } from "./utils.ts";

export const INVESTIGATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      properties: {
        handle: { type: "string" },
        displayName: { type: "string" },
        bioSummary: { type: "string" },
        accountHistory: { type: "string" },
        activitySummary: { type: "string" },
      },
      required: ["handle", "displayName", "bioSummary", "accountHistory", "activitySummary"],
    },
    metrics: {
      type: "object",
      additionalProperties: false,
      properties: {
        contentOriginality: { type: "number", minimum: 0, maximum: 100 },
        identityContinuity: { type: "number", minimum: 0, maximum: 100 },
        engagementQuality: { type: "number", minimum: 0, maximum: 100 },
        socialDiversity: { type: "number", minimum: 0, maximum: 100 },
        campaignConcentration: { type: "number", minimum: 0, maximum: 100 },
        reciprocityPressure: { type: "number", minimum: 0, maximum: 100 },
        automationPattern: { type: "number", minimum: 0, maximum: 100 },
        temporalAnomalies: { type: "number", minimum: 0, maximum: 100 },
        networkCoordination: { type: "number", minimum: 0, maximum: 100 },
      },
      required: [
        "contentOriginality",
        "identityContinuity",
        "engagementQuality",
        "socialDiversity",
        "campaignConcentration",
        "reciprocityPressure",
        "automationPattern",
        "temporalAnomalies",
        "networkCoordination"
      ],
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: ["authenticity", "farmer", "bot", "sybil"] },
          label: { type: "string" },
          observation: { type: "string" },
          impact: { type: "string", enum: ["positive", "warning", "risk"] },
          severity: { type: "number", minimum: 0, maximum: 100 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          sourceUrls: { type: "array", items: { type: "string" } },
        },
        required: ["category", "label", "observation", "impact", "severity", "confidence", "sourceUrls"],
      },
    },
    summary: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: ["profile", "metrics", "evidence", "summary", "confidence", "uncertainties"],
} as const;

const metricKeys: (keyof GrokMetrics)[] = [
  "contentOriginality",
  "identityContinuity",
  "engagementQuality",
  "socialDiversity",
  "campaignConcentration",
  "reciprocityPressure",
  "automationPattern",
  "temporalAnomalies",
  "networkCoordination",
];

function stringValue(value: unknown, fallback = "Unknown"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return clamp(value, min, max);
}

function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseGrokInvestigation(value: unknown, requestedHandle: string): GrokInvestigation {
  if (!value || typeof value !== "object") throw new Error("xAI returned an invalid assessment object.");
  const root = value as Record<string, unknown>;
  const rawProfile = (root.profile ?? {}) as Record<string, unknown>;
  const rawMetrics = (root.metrics ?? {}) as Record<string, unknown>;

  const metrics = {} as GrokMetrics;
  for (const key of metricKeys) metrics[key] = numberValue(rawMetrics[key], 0, 100);

  const rawEvidence = Array.isArray(root.evidence) ? root.evidence : [];
  const evidence: EvidenceItem[] = rawEvidence.slice(0, 24).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const category = row.category;
    const impact = row.impact;
    if (!["authenticity", "farmer", "bot", "sybil"].includes(String(category))) return [];
    if (!["positive", "warning", "risk"].includes(String(impact))) return [];
    const sourceUrls = Array.isArray(row.sourceUrls)
      ? row.sourceUrls.map(safeSourceUrl).filter((url): url is string => Boolean(url)).slice(0, 5)
      : [];

    return [{
      category: category as EvidenceItem["category"],
      label: stringValue(row.label, "Observed pattern"),
      observation: stringValue(row.observation, "No explanation supplied."),
      impact: impact as EvidenceItem["impact"],
      severity: numberValue(row.severity, 0, 100),
      confidence: numberValue(row.confidence, 0, 1),
      sourceUrls,
    }];
  });

  return {
    profile: {
      handle: requestedHandle,
      displayName: stringValue(rawProfile.displayName, `@${requestedHandle}`),
      bioSummary: stringValue(rawProfile.bioSummary, "Profile summary unavailable."),
      accountHistory: stringValue(rawProfile.accountHistory, "Account history could not be established."),
      activitySummary: stringValue(rawProfile.activitySummary, "Activity summary unavailable."),
    },
    metrics,
    evidence,
    summary: stringValue(root.summary, "No summary supplied."),
    confidence: numberValue(root.confidence, 0, 1),
    uncertainties: Array.isArray(root.uncertainties)
      ? root.uncertainties.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
  };
}
