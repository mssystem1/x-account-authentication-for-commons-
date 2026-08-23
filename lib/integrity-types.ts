export type CommonsActionKind = "vouch" | "slash";
export type IntegrityVerdict =
  | "LIKELY_ORGANIC"
  | "SUPPORT_REVIEW"
  | "SUPPORT_COORDINATION_RISK"
  | "HEAVY_SLASH_PRESSURE"
  | "SLASH_ATTACK_RISK"
  | "CONTESTED_MANIPULATION"
  | "INSUFFICIENT_DATA";
export type EvidenceImpact = "positive" | "warning" | "risk";
export type EvidenceDomain = "support" | "attack" | "rank" | "coverage";

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
  retaliatedByTarget: boolean;
  internalVouchLinks: number;
  internalSlashLinks: number;
  graphLoaded: boolean;
}

export interface IntegrityMetrics {
  supportIntegrity: number;
  supportCoordinationRisk: number;
  supportReciprocityRisk: number;
  supportConcentrationRisk: number;
  supportTimingRisk: number;
  supportThinAccountRisk: number;
  slashAttackRisk: number;
  attackPressure: number;
  attackCoordinationRisk: number;
  attackTimingRisk: number;
  attackConcentrationRisk: number;
  attackThinAccountRisk: number;
  botSybilNetworkRisk: number;
  rankDistortionRisk: number;
  rankReliability: number;
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
  negativeActionShare: number;
  slashToBaseRatio: number;
  voucherSlasherOverlapCount: number;

  analyzedVouchers: number;
  analyzedSlashers: number;
  totalSupporters: number;
  vouchGraphCoverage: number;
  slashGraphCoverage: number;

  reciprocalVoucherCount: number;
  reciprocalVoucherRatio: number;
  targetSlashRetaliationCount: number;
  targetSlashRetaliationRatio: number;

  internalVoucherVouchEdges: number;
  internalVoucherSlashEdges: number;
  internalSlasherVouchEdges: number;
  internalSlasherSlashEdges: number;
  voucherLargestComponentSize: number;
  voucherLargestComponentShare: number;
  slasherLargestComponentSize: number;
  slasherLargestComponentShare: number;
  voucherEdgeDensity: number;
  slasherEdgeDensity: number;
  voucherEdgesPerAnalyzedActor: number;
  slasherEdgesPerAnalyzedActor: number;

  top1VouchPointShare: number;
  top5VouchPointShare: number;
  vouchPointHhi: number;
  top1SlashPointShare: number;
  top5SlashPointShare: number;
  slashPointHhi: number;

  maxVouches5m: number;
  maxVouches15m: number;
  maxVouches60m: number;
  rapidVouch15mShare: number;
  rapidVouch60mShare: number;
  maxSlashes5m: number;
  maxSlashes15m: number;
  maxSlashes60m: number;
  rapidSlash15mShare: number;
  rapidSlash60mShare: number;

  medianVoucherEstimatedBasePoints: number;
  medianSlasherEstimatedBasePoints: number;
  thinVoucherCount: number;
  thinVoucherShare: number;
  thinSlasherCount: number;
  thinSlasherShare: number;
}

export interface IntegrityEvidence {
  domain: EvidenceDomain;
  label: string;
  observation: string;
  impact: EvidenceImpact;
  severity: number;
}

export interface GrokIntegrityReport {
  verdict: IntegrityVerdict;
  headline: string;
  explanation: string;
  supportAssessment: string;
  attackAssessment: string;
  confidence: number;
  organicSignals: string[];
  supportRiskSignals: string[];
  attackRiskSignals: string[];
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
