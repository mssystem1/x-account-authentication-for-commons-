export type CommonsActionKind = "vouch" | "slash";
export type IntegrityVerdict = "LIKELY_ORGANIC" | "MIXED" | "HIGH_COORDINATION_RISK" | "INSUFFICIENT_DATA";
export type EvidenceImpact = "positive" | "warning" | "risk";

export interface CommonsLedgerEntry {
  kind: CommonsActionKind;
  authorHandle: string;
  authorAvatarUrl: string | null;
  points: number;
  tweetText: string;
  tweetUrl: string | null;
  createdAt: string | null;
}

export interface CommonsLedger {
  handle: string;
  display: string | null;
  rank: number | null;
  totalPoints: number;
  entries: CommonsLedgerEntry[];
}

export interface SupporterProfile {
  handle: string;
  action: CommonsActionKind;
  points: number;
  estimatedBasePoints: number;
  commonsRank: number | null;
  commonsTotalPoints: number | null;
  incomingVouches: number;
  incomingSlashes: number;
  uniqueIncomingActors: number;
  reciprocatedByTarget: boolean;
  internalVouchLinks: number;
  internalSlashLinks: number;
  graphLoaded: boolean;
}

export interface IntegrityMetrics {
  integrityScore: number;
  organicSupport: number;
  coordinationRisk: number;
  reciprocityRisk: number;
  concentrationRisk: number;
  timingRisk: number;
  lowQualitySupportRisk: number;
  botSybilSupportRisk: number;
}

export interface NetworkStats {
  incomingVouches: number;
  incomingSlashes: number;
  uniqueVouchers: number;
  uniqueSlashers: number;
  vouchPoints: number;
  slashPoints: number;
  netLedgerImpact: number;
  estimatedTargetBasePoints: number;
  estimatedNetSupportShare: number;
  analyzedSupporters: number;
  totalSupporters: number;
  graphCoverage: number;
  reciprocalVoucherCount: number;
  reciprocalVoucherRatio: number;
  internalVouchEdges: number;
  internalSlashEdges: number;
  largestComponentSize: number;
  largestComponentShare: number;
  internalEdgeDensity: number;
  top1PointShare: number;
  top5PointShare: number;
  pointHhi: number;
  maxVouches15m: number;
  maxVouches60m: number;
  rapid15mShare: number;
  rapid60mShare: number;
  medianEstimatedBasePoints: number;
  lowPowerVoucherCount: number;
  lowPowerVoucherShare: number;
}

export interface IntegrityEvidence {
  label: string;
  observation: string;
  impact: EvidenceImpact;
  severity: number;
}

export interface GrokIntegrityReport {
  verdict: IntegrityVerdict;
  headline: string;
  explanation: string;
  confidence: number;
  organicSignals: string[];
  riskSignals: string[];
  caveats: string[];
}

export interface IntegrityAuditResult {
  id: string;
  handle: string;
  createdAt: string;
  mode: "live" | "demo";
  methodologyVersion: string;
  commons: {
    rank: number | null;
    totalPoints: number;
    display: string | null;
  };
  metrics: IntegrityMetrics;
  stats: NetworkStats;
  supporters: SupporterProfile[];
  evidence: IntegrityEvidence[];
  report: GrokIntegrityReport;
  sourceEntries: CommonsLedgerEntry[];
  cached?: boolean;
  permalink?: string;
}
