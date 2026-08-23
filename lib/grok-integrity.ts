import type {
  GrokIntegrityReport,
  IntegrityEvidence,
  IntegrityMetrics,
  IntegrityVerdict,
  NetworkStats,
  SupporterProfile,
} from "./integrity-types.ts";
import { clamp } from "./utils.ts";

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["LIKELY_ORGANIC", "MIXED", "HIGH_COORDINATION_RISK", "INSUFFICIENT_DATA"] },
    headline: { type: "string" },
    explanation: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    organicSignals: { type: "array", items: { type: "string" }, maxItems: 6 },
    riskSignals: { type: "array", items: { type: "string" }, maxItems: 6 },
    caveats: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
  required: ["verdict", "headline", "explanation", "confidence", "organicSignals", "riskSignals", "caveats"],
} as const;

interface XaiResponse {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
}

function responseText(response: XaiResponse): string {
  if (response.output_text?.trim()) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) return content.text;
    }
  }
  throw new Error("xAI returned no integrity report text.");
}

function defaultVerdict(metrics: IntegrityMetrics, stats: NetworkStats): IntegrityVerdict {
  if (stats.uniqueVouchers < 2) return "INSUFFICIENT_DATA";
  if (metrics.coordinationRisk >= 70 || metrics.botSybilSupportRisk >= 70) return "HIGH_COORDINATION_RISK";
  if (metrics.integrityScore >= 72 && metrics.coordinationRisk < 45) return "LIKELY_ORGANIC";
  return "MIXED";
}

function fallbackReport(metrics: IntegrityMetrics, stats: NetworkStats, reason?: string): GrokIntegrityReport {
  const verdict = defaultVerdict(metrics, stats);
  const headline = verdict === "LIKELY_ORGANIC"
    ? "Support appears mostly organic in the observed Commons graph."
    : verdict === "HIGH_COORDINATION_RISK"
      ? "The Commons support graph contains strong coordination signals."
      : verdict === "INSUFFICIENT_DATA"
        ? "There is not enough Commons support data for a strong verdict."
        : "The support pattern is mixed and deserves manual review.";

  return {
    verdict,
    headline,
    explanation: `VouchGuard computed the verdict from Commons ledger structure: integrity ${metrics.integrityScore}/100, coordination risk ${metrics.coordinationRisk}/100, reciprocity risk ${metrics.reciprocityRisk}/100, and ${Math.round(stats.graphCoverage * 100)}% second-hop graph coverage.`,
    confidence: clamp(0.45 + stats.graphCoverage * 0.4, 0, 0.85),
    organicSignals: [
      `${stats.uniqueVouchers} unique vouchers are visible in the target ledger.`,
      `Top supporter contributes ${Math.round(stats.top1PointShare * 100)}% of observed vouch points.`,
    ],
    riskSignals: [
      `${Math.round(stats.reciprocalVoucherRatio * 100)}% of unique vouchers appear reciprocal with the target.`,
      `Largest connected voucher component contains ${Math.round(stats.largestComponentShare * 100)}% of vouchers.`,
    ],
    caveats: [
      "Commons graph patterns can indicate coordination but cannot prove that multiple accounts share one operator.",
      ...(reason ? [`Grok report fallback was used: ${reason}`] : []),
    ],
  };
}

function parseReport(value: unknown): GrokIntegrityReport {
  if (!value || typeof value !== "object") throw new Error("Invalid Grok integrity report.");
  const row = value as Record<string, unknown>;
  const verdicts: IntegrityVerdict[] = ["LIKELY_ORGANIC", "MIXED", "HIGH_COORDINATION_RISK", "INSUFFICIENT_DATA"];
  if (!verdicts.includes(row.verdict as IntegrityVerdict)) throw new Error("Invalid Grok verdict.");
  const list = (key: string) => Array.isArray(row[key]) ? row[key]!.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  return {
    verdict: row.verdict as IntegrityVerdict,
    headline: typeof row.headline === "string" ? row.headline : "Commons integrity assessment",
    explanation: typeof row.explanation === "string" ? row.explanation : "No explanation supplied.",
    confidence: typeof row.confidence === "number" ? clamp(row.confidence, 0, 1) : 0.5,
    organicSignals: list("organicSignals"),
    riskSignals: list("riskSignals"),
    caveats: list("caveats"),
  };
}

export async function buildGrokIntegrityReport(input: {
  handle: string;
  rank: number | null;
  totalPoints: number;
  metrics: IntegrityMetrics;
  stats: NetworkStats;
  supporters: SupporterProfile[];
  evidence: IntegrityEvidence[];
}): Promise<GrokIntegrityReport> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return fallbackReport(input.metrics, input.stats, "XAI_API_KEY is not configured");

  const supporterRows = input.supporters.slice(0, 30).map((supporter) => ({
    handle: supporter.handle,
    action: supporter.action,
    points: supporter.points,
    estimatedBasePoints: supporter.estimatedBasePoints,
    commonsRank: supporter.commonsRank,
    incomingVouches: supporter.incomingVouches,
    incomingSlashes: supporter.incomingSlashes,
    uniqueIncomingActors: supporter.uniqueIncomingActors,
    reciprocatedByTarget: supporter.reciprocatedByTarget,
    internalVouchLinks: supporter.internalVouchLinks,
    graphLoaded: supporter.graphLoaded,
  }));

  const prompt = `You are VouchGuard's Commons leaderboard integrity analyst.\n\nEvaluate whether @${input.handle}'s observed Commons rank/support appears primarily organic, mixed, or strongly coordinated. You are NOT determining criminality, identity ownership, or proving anyone is a bot/Sybil. Treat "bot/Sybil support risk" as a behavioral coordination-risk indicator only.\n\nThe deterministic application already calculated the metrics below. Do NOT recalculate or override the numeric scores. Your role is to explain them, identify the strongest organic and risk signals, and choose a verdict consistent with the evidence.\n\nImportant interpretation rules:\n- Reciprocity alone is not proof of manipulation.\n- A dense closed supporter cluster + high reciprocity + concentrated timing is stronger evidence than any one signal alone.\n- High point concentration can simply mean a few strong creators vouched; treat it as context, not proof.\n- Sparse/partial second-hop graph coverage must reduce confidence.\n- Do not use follower count, X Premium, post content, or facts not present in the supplied Commons data.\n\nDATA:\n${JSON.stringify({ rank: input.rank, totalPoints: input.totalPoints, metrics: input.metrics, stats: input.stats, supporters: supporterRows, evidence: input.evidence })}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.XAI_MODEL || "grok-4.5-latest",
        input: prompt,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "commons_integrity_report", schema: REPORT_SCHEMA, strict: true } },
      }),
      signal: controller.signal,
    });
    const payload = await response.json() as XaiResponse;
    if (!response.ok) throw new Error(payload.error?.message || `xAI request failed with HTTP ${response.status}`);
    const report = parseReport(JSON.parse(responseText(payload)) as unknown);

    // The deterministic engine owns the hard safety floor/ceiling for verdicts.
    const deterministic = defaultVerdict(input.metrics, input.stats);
    if (deterministic === "HIGH_COORDINATION_RISK" && report.verdict === "LIKELY_ORGANIC") report.verdict = "MIXED";
    if (deterministic === "INSUFFICIENT_DATA") report.verdict = "INSUFFICIENT_DATA";
    report.confidence = Math.min(report.confidence, 0.45 + input.stats.graphCoverage * 0.5);
    return report;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown xAI error";
    return fallbackReport(input.metrics, input.stats, reason);
  } finally {
    clearTimeout(timeout);
  }
}
