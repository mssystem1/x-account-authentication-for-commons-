export type RiskCategory = "authenticity" | "farmer" | "bot" | "sybil";
export type EvidenceImpact = "positive" | "warning" | "risk";
export type Recommendation = "VOUCH" | "SKIP" | "REVIEW_SLASH";
export type ConfidenceLabel = "low" | "medium" | "high";

export interface AccountProfile {
  handle: string;
  displayName: string;
  bioSummary: string;
  accountHistory: string;
  activitySummary: string;
}

export interface GrokMetrics {
  contentOriginality: number;
  identityContinuity: number;
  engagementQuality: number;
  socialDiversity: number;
  campaignConcentration: number;
  reciprocityPressure: number;
  automationPattern: number;
  temporalAnomalies: number;
  networkCoordination: number;
}

export interface EvidenceItem {
  category: RiskCategory;
  label: string;
  observation: string;
  impact: EvidenceImpact;
  severity: number;
  confidence: number;
  sourceUrls: string[];
}

export interface GrokInvestigation {
  profile: AccountProfile;
  metrics: GrokMetrics;
  evidence: EvidenceItem[];
  summary: string;
  confidence: number;
  uncertainties: string[];
}

export interface RiskScores {
  authenticity: number;
  farmerRisk: number;
  botRisk: number;
  sybilRisk: number;
  vouchConfidence: number;
}

export interface ScanResult {
  id: string;
  handle: string;
  createdAt: string;
  model: string;
  mode: "live" | "demo";
  scores: RiskScores;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  recommendation: Recommendation;
  summary: string;
  profile: AccountProfile;
  evidence: EvidenceItem[];
  uncertainties: string[];
  sourceUrls: string[];
  methodologyVersion: string;
  cached?: boolean;
  permalink?: string;
}
