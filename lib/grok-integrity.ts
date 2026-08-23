import type {
  GrokIntegrityReport,
  IntegrityEvidence,
  IntegrityMetrics,
  IntegrityVerdict,
  NetworkStats,
  SupporterProfile,
} from "./integrity-types.ts";
import { rankVerdict } from "./verdict.ts";
import { clamp } from "./utils.ts";

const VERDICTS: IntegrityVerdict[] = [
  "LIKELY_ORGANIC",
  "SUPPORT_REVIEW",
  "SUPPORT_COORDINATION_RISK",
  "HEAVY_SLASH_PRESSURE",
  "SLASH_ATTACK_RISK",
  "CONTESTED_MANIPULATION",
  "INSUFFICIENT_DATA",
];

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: VERDICTS },
    headline: { type: "string" },
    explanation: { type: "string" },
    supportAssessment: { type: "string" },
    attackAssessment: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    organicSignals: { type: "array", items: { type: "string" }, maxItems: 6 },
    supportRiskSignals: { type: "array", items: { type: "string" }, maxItems: 6 },
    attackRiskSignals: { type: "array", items: { type: "string" }, maxItems: 6 },
    caveats: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
  required: ["verdict", "headline", "explanation", "supportAssessment", "attackAssessment", "confidence", "organicSignals", "supportRiskSignals", "attackRiskSignals", "caveats"],
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

function headlineFor(verdict: IntegrityVerdict): string {
  if (verdict === "LIKELY_ORGANIC") return "Observed support looks broadly organic and no major slash-attack pattern is visible.";
  if (verdict === "SUPPORT_REVIEW") return "The rank is support-dependent or under-sampled; positive support needs further review.";
  if (verdict === "SUPPORT_COORDINATION_RISK") return "The incoming vouch network contains meaningful coordination signals.";
  if (verdict === "HEAVY_SLASH_PRESSURE") return "The rank has been heavily affected by mass slashing; attacker coordination is not yet established.";
  if (verdict === "SLASH_ATTACK_RISK") return "The incoming slash pattern contains elevated attack/coordination signals.";
  if (verdict === "CONTESTED_MANIPULATION") return "Both positive support and negative slash activity contain coordination signals.";
  return "There is not enough Commons graph data for a strong verdict.";
}

function confidenceCap(stats: NetworkStats): number {
  const relevant: number[] = [];
  if (stats.uniqueVouchers) relevant.push(stats.vouchGraphCoverage);
  if (stats.uniqueSlashers) relevant.push(stats.slashGraphCoverage);
  const minCoverage = relevant.length ? Math.min(...relevant) : 0;
  return clamp(0.45 + minCoverage * 0.5, 0.45, 0.88);
}

function fallbackReport(metrics: IntegrityMetrics, stats: NetworkStats, reason?: string): GrokIntegrityReport {
  const verdict = rankVerdict(metrics, stats);
  return {
    verdict,
    headline: headlineFor(verdict),
    explanation: `VouchGuard separates positive-support integrity from negative slash pressure. Support integrity is ${metrics.supportIntegrity}/100, support coordination risk ${metrics.supportCoordinationRisk}/100, slash attack risk ${metrics.slashAttackRisk}/100, attack coordination risk ${metrics.attackCoordinationRisk}/100, and rank distortion risk ${metrics.rankDistortionRisk}/100.`,
    supportAssessment: `${stats.uniqueVouchers} unique vouchers contributed ${stats.vouchPoints.toLocaleString()} points; ${Math.round(stats.vouchGraphCoverage * 100)}% of voucher second-hop ledgers were sampled.`,
    attackAssessment: `${stats.uniqueSlashers} unique slashers removed ${stats.slashPoints.toLocaleString()} points; ${Math.round(stats.slashGraphCoverage * 100)}% of slasher second-hop ledgers were sampled. Heavy slash pressure is not, by itself, proof of bots or shared ownership.`,
    confidence: confidenceCap(stats),
    organicSignals: [
      `${stats.uniqueVouchers} unique vouchers are visible in the target ledger.`,
      `Top voucher contributes ${Math.round(stats.top1VouchPointShare * 100)}% of observed vouch points.`,
    ],
    supportRiskSignals: [
      `${Math.round(stats.reciprocalVoucherRatio * 100)}% of unique vouchers appear reciprocal with the target.`,
      `Largest voucher component contains ${Math.round(stats.voucherLargestComponentShare * 100)}% of vouchers.`,
    ],
    attackRiskSignals: [
      `${stats.uniqueSlashers} unique slashers removed ${stats.slashPoints.toLocaleString()} points.`,
      `Largest slash burst was ${stats.maxSlashes15m} actions in 15 minutes; slasher graph coverage is ${Math.round(stats.slashGraphCoverage * 100)}%.`,
    ],
    caveats: [
      "Commons graph patterns can indicate coordination but cannot prove that multiple accounts share one operator or that an account is automated.",
      ...(reason ? [`Grok report fallback was used: ${reason}`] : []),
    ],
  };
}

function parseReport(value: unknown): GrokIntegrityReport {
  if (!value || typeof value !== "object") throw new Error("Invalid Grok integrity report.");
  const row = value as Record<string, unknown>;
  if (!VERDICTS.includes(row.verdict as IntegrityVerdict)) throw new Error("Invalid Grok verdict.");
  const list = (key: string) => Array.isArray(row[key]) ? row[key]!.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  return {
    verdict: row.verdict as IntegrityVerdict,
    headline: typeof row.headline === "string" ? row.headline : "Commons rank audit",
    explanation: typeof row.explanation === "string" ? row.explanation : "No explanation supplied.",
    supportAssessment: typeof row.supportAssessment === "string" ? row.supportAssessment : "Support assessment unavailable.",
    attackAssessment: typeof row.attackAssessment === "string" ? row.attackAssessment : "Slash-attack assessment unavailable.",
    confidence: typeof row.confidence === "number" ? clamp(row.confidence, 0, 1) : 0.5,
    organicSignals: list("organicSignals"),
    supportRiskSignals: list("supportRiskSignals"),
    attackRiskSignals: list("attackRiskSignals"),
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

  const voucherRows = input.supporters.filter((supporter) => supporter.action === "vouch").slice(0, 20);
  const slasherRows = input.supporters.filter((supporter) => supporter.action === "slash").slice(0, 20);
  const compact = (supporter: SupporterProfile) => ({
    handle: supporter.handle,
    action: supporter.action,
    points: supporter.points,
    estimatedBasePoints: supporter.estimatedBasePoints,
    commonsRank: supporter.commonsRank,
    uniqueIncomingActors: supporter.uniqueIncomingActors,
    targetReturnedSameAction: supporter.action === "vouch" ? supporter.reciprocatedByTarget : supporter.retaliatedByTarget,
    internalVouchLinks: supporter.internalVouchLinks,
    internalSlashLinks: supporter.internalSlashLinks,
    graphLoaded: supporter.graphLoaded,
  });

  const deterministic = rankVerdict(input.metrics, input.stats);
  const prompt = `You are VouchGuard's Commons leaderboard integrity analyst.\n\nYour job is to explain TWO DIFFERENT AXES for @${input.handle}:\n1) SUPPORT INTEGRITY: whether incoming VOUCH support looks diverse/natural or coordinated.\n2) SLASH ATTACK RISK: whether incoming SLASH activity looks like ordinary negative community action, heavy slash pressure, or a coordination-suspicious attack pattern.\n\nThe deterministic application already calculated every numeric metric and the controlling verdict ${deterministic}. Do NOT recalculate scores and do NOT override that verdict. Return verdict exactly as ${deterministic}.\n\nCritical rules:\n- Heavy slashing is NOT proof of bots. Distinguish attack PRESSURE from attack COORDINATION.\n- A low attackCoordinationRisk with low slasher graph coverage means coordination is unresolved, not disproven.\n- 'Bot/Sybil Network Risk' is a behavioral graph signal only; never claim shared ownership or automation as fact.\n- High net support dependence can mean popularity. It warrants caution when graph coverage is low, but is not manipulation by itself.\n- Reciprocity alone is not proof of manipulation.\n- A large connected supporter component matters even when global edge density is low, especially with partial graph sampling.\n- Do not use follower count, X Premium, external posts, reputation, or facts not present in this dataset.\n- If the target was heavily slashed, explain that a high support-integrity score does NOT mean the overall rank is trustworthy or unaffected.\n\nDATA:\n${JSON.stringify({ rank: input.rank, totalPoints: input.totalPoints, deterministicVerdict: deterministic, metrics: input.metrics, stats: input.stats, topVouchers: voucherRows.map(compact), topSlashers: slasherRows.map(compact), evidence: input.evidence })}`;

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
        text: { format: { type: "json_schema", name: "commons_rank_audit", schema: REPORT_SCHEMA, strict: true } },
      }),
      signal: controller.signal,
    });
    const payload = await response.json() as XaiResponse;
    if (!response.ok) throw new Error(payload.error?.message || `xAI request failed with HTTP ${response.status}`);
    const report = parseReport(JSON.parse(responseText(payload)) as unknown);
    report.verdict = deterministic;
    report.confidence = Math.min(report.confidence, confidenceCap(input.stats));
    return report;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown xAI error";
    return fallbackReport(input.metrics, input.stats, reason);
  } finally {
    clearTimeout(timeout);
  }
}
