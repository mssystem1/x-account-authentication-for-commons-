import type { EvidenceItem, GrokInvestigation } from "./types.ts";

function hashHandle(handle: string): number {
  let hash = 2166136261;
  for (const char of handle) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function evidence(category: EvidenceItem["category"], label: string, observation: string, impact: EvidenceItem["impact"], severity: number): EvidenceItem {
  return { category, label, observation, impact, severity, confidence: 0.9, sourceUrls: [] };
}

export function demoInvestigation(handle: string): GrokInvestigation {
  const seed = hashHandle(handle);
  const lower = handle.toLowerCase();
  const isBot = /bot|auto|swarm/.test(lower);
  const isFarmer = /farm|yield|airdrop|points/.test(lower);
  const isSybil = /sybil|swarm|cluster/.test(lower);
  const jitter = seed % 9;

  const metrics = {
    contentOriginality: isBot ? 18 + jitter : isFarmer ? 42 + jitter : 82 + jitter,
    identityContinuity: isSybil ? 34 + jitter : 79 + jitter,
    engagementQuality: isBot ? 20 + jitter : isFarmer ? 48 + jitter : 81 + jitter,
    socialDiversity: isSybil ? 25 + jitter : isFarmer ? 46 + jitter : 80 + jitter,
    campaignConcentration: isFarmer ? 88 - jitter : isBot ? 61 - jitter : 17 + jitter,
    reciprocityPressure: isFarmer ? 83 - jitter : isBot ? 58 - jitter : 14 + jitter,
    automationPattern: isBot ? 91 - jitter : isSybil ? 54 + jitter : 9 + jitter,
    temporalAnomalies: isBot ? 87 - jitter : isSybil ? 49 + jitter : 11 + jitter,
    networkCoordination: isSybil ? 92 - jitter : isFarmer ? 62 + jitter : 13 + jitter,
  };

  const items: EvidenceItem[] = [
    evidence("authenticity", "Account continuity", isSybil ? "The simulated history shows limited continuity outside a narrow interaction cluster." : "The simulated history shows a stable voice and topics across time.", isSybil ? "warning" : "positive", isSybil ? 58 : 18),
    evidence("authenticity", "Original content", isBot ? "The simulated feed is dominated by mechanically similar replies." : "The simulated feed contains substantial original posts and conversations.", isBot ? "risk" : "positive", isBot ? 86 : 12),
    evidence("farmer", "Campaign concentration", isFarmer ? "Most simulated recent activity is centered on points, reciprocal support, quests, and campaign calls to action." : "Campaign activity is present but does not dominate the simulated account history.", isFarmer ? "risk" : "positive", isFarmer ? 90 : 18),
    evidence("bot", "Automation pattern", isBot ? "The simulation detects repetitive text structure and implausibly regular activity bursts." : "Posting cadence and language vary naturally in the simulation.", isBot ? "risk" : "positive", isBot ? 92 : 10),
    evidence("sybil", "Coordination pattern", isSybil ? "The simulation detects a dense recurring cluster with synchronized reciprocal interactions." : "The simulated interaction graph is diverse and does not show a tight reciprocal cluster.", isSybil ? "risk" : "positive", isSybil ? 93 : 13),
  ];

  return {
    profile: {
      handle,
      displayName: `@${handle}`,
      bioSummary: "Synthetic demo profile generated for end-to-end testing.",
      accountHistory: "Demo mode uses deterministic synthetic behavior and never calls xAI.",
      activitySummary: isBot ? "Highly repetitive simulated activity." : isFarmer ? "Campaign-heavy simulated activity." : "Mixed original posts and conversations in the simulated history.",
    },
    metrics,
    evidence: items,
    summary: isBot || isSybil
      ? "The simulated account shows multiple high-risk behavioral patterns and should be reviewed carefully before any Commons action."
      : isFarmer
        ? "The simulated identity looks human, but recent behavior is heavily optimized around incentive campaigns and reciprocal support."
        : "The simulated account shows strong identity continuity, original activity, and relatively low farming, automation, and coordination signals.",
    confidence: 0.91,
    uncertainties: ["This is a deterministic demo result, not an assessment of a real X account."],
  };
}
