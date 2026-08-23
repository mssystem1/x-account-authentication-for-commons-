import type {
  CommonsLedger,
  IntegrityEvidence,
  IntegrityMetrics,
  NetworkStats,
  SupporterProfile,
} from "./integrity-types.ts";
import { clamp, roundScore } from "./utils.ts";

const VOUCH_POWER_RATIO = 0.35;

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function maxEventsWithin(timestamps: number[], windowMs: number): number {
  if (!timestamps.length) return 0;
  const sorted = [...timestamps].sort((a, b) => a - b);
  let best = 1;
  let left = 0;
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right]! - sorted[left]! > windowMs) left++;
    best = Math.max(best, right - left + 1);
  }
  return best;
}

function connectedComponents(nodes: string[], edges: Array<[string, string]>): number[] {
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node, new Set());
  for (const [a, b] of edges) {
    if (!adjacency.has(a) || !adjacency.has(b) || a === b) continue;
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }
  const seen = new Set<string>();
  const sizes: number[] = [];
  for (const node of nodes) {
    if (seen.has(node)) continue;
    let size = 0;
    const queue = [node];
    seen.add(node);
    while (queue.length) {
      const current = queue.pop()!;
      size++;
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

export function buildSupporterProfiles(
  target: CommonsLedger,
  supporterLedgers: Map<string, CommonsLedger | null>,
): SupporterProfile[] {
  const actorHandles = new Set(target.entries.map((entry) => entry.authorHandle.toLowerCase()));
  const grouped = new Map<string, { handle: string; action: "vouch" | "slash"; points: number; maxAbsPoints: number }>();

  for (const entry of target.entries) {
    const key = `${entry.authorHandle.toLowerCase()}:${entry.kind}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.points += entry.points;
      existing.maxAbsPoints = Math.max(existing.maxAbsPoints, Math.abs(entry.points));
    } else {
      grouped.set(key, {
        handle: entry.authorHandle,
        action: entry.kind,
        points: entry.points,
        maxAbsPoints: Math.abs(entry.points),
      });
    }
  }

  return [...grouped.values()].map((row) => {
    const ledger = supporterLedgers.get(row.handle.toLowerCase()) ?? null;
    const incomingVouches = ledger?.entries.filter((entry) => entry.kind === "vouch").length ?? 0;
    const incomingSlashes = ledger?.entries.filter((entry) => entry.kind === "slash").length ?? 0;
    const uniqueIncomingActors = ledger ? new Set(ledger.entries.map((entry) => entry.authorHandle.toLowerCase())).size : 0;
    const reciprocatedByTarget = Boolean(ledger?.entries.some(
      (entry) => entry.kind === "vouch" && entry.authorHandle.toLowerCase() === target.handle.toLowerCase(),
    ));
    const internalVouchLinks = ledger?.entries.filter(
      (entry) => entry.kind === "vouch" && actorHandles.has(entry.authorHandle.toLowerCase()) && entry.authorHandle.toLowerCase() !== row.handle.toLowerCase(),
    ).length ?? 0;
    const internalSlashLinks = ledger?.entries.filter(
      (entry) => entry.kind === "slash" && actorHandles.has(entry.authorHandle.toLowerCase()) && entry.authorHandle.toLowerCase() !== row.handle.toLowerCase(),
    ).length ?? 0;

    return {
      handle: row.handle,
      action: row.action,
      points: Math.round(row.points),
      estimatedBasePoints: Math.round(row.maxAbsPoints / VOUCH_POWER_RATIO),
      commonsRank: ledger?.rank ?? null,
      commonsTotalPoints: ledger?.totalPoints ?? null,
      incomingVouches,
      incomingSlashes,
      uniqueIncomingActors,
      reciprocatedByTarget,
      internalVouchLinks,
      internalSlashLinks,
      graphLoaded: Boolean(ledger),
    };
  }).sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

export function calculateNetworkStats(
  target: CommonsLedger,
  supporterLedgers: Map<string, CommonsLedger | null>,
  profiles: SupporterProfile[],
): NetworkStats {
  const vouchEntries = target.entries.filter((entry) => entry.kind === "vouch");
  const slashEntries = target.entries.filter((entry) => entry.kind === "slash");
  const voucherHandles = [...new Set(vouchEntries.map((entry) => entry.authorHandle.toLowerCase()))];
  const slasherHandles = [...new Set(slashEntries.map((entry) => entry.authorHandle.toLowerCase()))];
  const voucherSet = new Set(voucherHandles);
  const analyzedVoucherLedgers = voucherHandles.filter((handle) => supporterLedgers.get(handle)).length;

  const internalEdges = new Set<string>();
  const internalSlashEdges = new Set<string>();
  for (const recipient of voucherHandles) {
    const ledger = supporterLedgers.get(recipient);
    if (!ledger) continue;
    for (const entry of ledger.entries) {
      const source = entry.authorHandle.toLowerCase();
      if (!voucherSet.has(source) || source === recipient) continue;
      const key = `${source}->${recipient}`;
      if (entry.kind === "vouch") internalEdges.add(key);
      if (entry.kind === "slash") internalSlashEdges.add(key);
    }
  }

  const componentSizes = connectedComponents(
    voucherHandles,
    [...internalEdges].map((edge) => edge.split("->") as [string, string]),
  );
  const largestComponentSize = componentSizes[0] ?? 0;
  const possibleDirectedEdges = voucherHandles.length * Math.max(0, voucherHandles.length - 1);

  const vouchByActor = new Map<string, number>();
  for (const entry of vouchEntries) {
    const key = entry.authorHandle.toLowerCase();
    vouchByActor.set(key, (vouchByActor.get(key) ?? 0) + Math.abs(entry.points));
  }
  const pointValues = [...vouchByActor.values()].sort((a, b) => b - a);
  const totalVouchPoints = pointValues.reduce((sum, value) => sum + value, 0);
  const shares = pointValues.map((value) => ratio(value, totalVouchPoints));
  const timestamps = vouchEntries
    .map((entry) => entry.createdAt ? Date.parse(entry.createdAt) : NaN)
    .filter((value) => Number.isFinite(value));
  const max15 = maxEventsWithin(timestamps, 15 * 60 * 1000);
  const max60 = maxEventsWithin(timestamps, 60 * 60 * 1000);

  const voucherProfiles = profiles.filter((profile) => profile.action === "vouch");
  const bases = voucherProfiles.map((profile) => profile.estimatedBasePoints).filter((value) => value > 0);
  const medianBase = median(bases);
  const lowPowerThreshold = medianBase > 0 ? medianBase * 0.25 : 0;
  const lowPowerVoucherCount = voucherProfiles.filter((profile) => {
    const thinGraph = profile.graphLoaded && profile.uniqueIncomingActors <= 1;
    const lowPower = lowPowerThreshold > 0 && profile.estimatedBasePoints < lowPowerThreshold;
    return thinGraph && lowPower;
  }).length;
  const reciprocalVoucherCount = voucherProfiles.filter((profile) => profile.reciprocatedByTarget).length;

  return {
    incomingVouches: vouchEntries.length,
    incomingSlashes: slashEntries.length,
    uniqueVouchers: voucherHandles.length,
    uniqueSlashers: slasherHandles.length,
    vouchPoints: Math.round(vouchEntries.reduce((sum, entry) => sum + Math.abs(entry.points), 0)),
    slashPoints: Math.round(slashEntries.reduce((sum, entry) => sum + Math.abs(entry.points), 0)),
    analyzedSupporters: profiles.filter((profile) => profile.graphLoaded).length,
    totalSupporters: new Set(target.entries.map((entry) => entry.authorHandle.toLowerCase())).size,
    graphCoverage: ratio(analyzedVoucherLedgers, voucherHandles.length),
    reciprocalVoucherCount,
    reciprocalVoucherRatio: ratio(reciprocalVoucherCount, voucherHandles.length),
    internalVouchEdges: internalEdges.size,
    internalSlashEdges: internalSlashEdges.size,
    largestComponentSize,
    largestComponentShare: ratio(largestComponentSize, voucherHandles.length),
    internalEdgeDensity: ratio(internalEdges.size, possibleDirectedEdges),
    top1PointShare: shares[0] ?? 0,
    top5PointShare: shares.slice(0, 5).reduce((sum, value) => sum + value, 0),
    pointHhi: shares.reduce((sum, value) => sum + value * value, 0),
    maxVouches15m: max15,
    maxVouches60m: max60,
    rapid15mShare: ratio(max15, vouchEntries.length),
    rapid60mShare: ratio(max60, vouchEntries.length),
    medianEstimatedBasePoints: Math.round(medianBase),
    lowPowerVoucherCount,
    lowPowerVoucherShare: ratio(lowPowerVoucherCount, voucherProfiles.length),
  };
}

function riskScale(value: number, start: number, full: number): number {
  if (value <= start) return 0;
  if (value >= full) return 100;
  return ((value - start) / (full - start)) * 100;
}

export function calculateIntegrityMetrics(stats: NetworkStats): IntegrityMetrics {
  const reciprocityRisk = roundScore(clamp(stats.reciprocalVoucherRatio * 125, 0, 100));
  const timingRisk = roundScore(Math.max(
    riskScale(stats.rapid15mShare, 0.2, 0.7),
    riskScale(stats.rapid60mShare, 0.35, 0.85) * 0.85,
  ));
  const concentrationRisk = roundScore(
    clamp(
      riskScale(stats.top1PointShare, 0.18, 0.55) * 0.45 +
      riskScale(stats.top5PointShare, 0.55, 0.95) * 0.35 +
      riskScale(stats.pointHhi, 0.12, 0.45) * 0.20,
      0,
      100,
    ),
  );
  const clusterRisk = Math.max(
    riskScale(stats.largestComponentShare, 0.35, 0.85),
    riskScale(stats.internalEdgeDensity, 0.08, 0.35),
  );
  const coordinationRisk = roundScore(clamp(
    clusterRisk * 0.48 + reciprocityRisk * 0.22 + timingRisk * 0.20 + concentrationRisk * 0.10,
    0,
    100,
  ));
  const lowQualitySupportRisk = roundScore(clamp(stats.lowPowerVoucherShare * 140, 0, 100));
  const botSybilSupportRisk = roundScore(clamp(
    coordinationRisk * 0.55 + lowQualitySupportRisk * 0.25 + timingRisk * 0.20,
    0,
    100,
  ));
  const organicSupport = roundScore(clamp(
    100 - (coordinationRisk * 0.42 + reciprocityRisk * 0.15 + concentrationRisk * 0.15 + timingRisk * 0.10 + lowQualitySupportRisk * 0.18),
    0,
    100,
  ));
  const coveragePenalty = stats.graphCoverage >= 0.8 ? 0 : stats.graphCoverage >= 0.5 ? 5 : 12;
  const integrityScore = roundScore(clamp(organicSupport - coveragePenalty, 0, 100));

  return {
    integrityScore,
    organicSupport,
    coordinationRisk,
    reciprocityRisk,
    concentrationRisk,
    timingRisk,
    lowQualitySupportRisk,
    botSybilSupportRisk,
  };
}

export function buildIntegrityEvidence(stats: NetworkStats, metrics: IntegrityMetrics): IntegrityEvidence[] {
  const evidence: IntegrityEvidence[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  evidence.push({
    label: "Voucher diversity",
    observation: `${stats.uniqueVouchers} unique vouchers contributed ${stats.vouchPoints.toLocaleString()} points.`,
    impact: stats.uniqueVouchers >= 8 ? "positive" : stats.uniqueVouchers >= 3 ? "warning" : "risk",
    severity: stats.uniqueVouchers >= 8 ? 15 : stats.uniqueVouchers >= 3 ? 45 : 75,
  });

  evidence.push({
    label: "Reciprocal support",
    observation: `${stats.reciprocalVoucherCount} of ${stats.uniqueVouchers} vouchers appear reciprocal with the target (${pct(stats.reciprocalVoucherRatio)}).`,
    impact: metrics.reciprocityRisk < 30 ? "positive" : metrics.reciprocityRisk < 65 ? "warning" : "risk",
    severity: metrics.reciprocityRisk,
  });

  evidence.push({
    label: "Supporter cluster",
    observation: `Largest connected voucher component contains ${stats.largestComponentSize}/${stats.uniqueVouchers} vouchers (${pct(stats.largestComponentShare)}); internal vouch density is ${pct(stats.internalEdgeDensity)}.`,
    impact: metrics.coordinationRisk < 30 ? "positive" : metrics.coordinationRisk < 65 ? "warning" : "risk",
    severity: metrics.coordinationRisk,
  });

  evidence.push({
    label: "Point concentration",
    observation: `Top voucher supplies ${pct(stats.top1PointShare)} of vouch points; top five supply ${pct(stats.top5PointShare)}.`,
    impact: metrics.concentrationRisk < 30 ? "positive" : metrics.concentrationRisk < 65 ? "warning" : "risk",
    severity: metrics.concentrationRisk,
  });

  evidence.push({
    label: "Timing concentration",
    observation: `Maximum burst: ${stats.maxVouches15m} vouches in 15 minutes and ${stats.maxVouches60m} in 60 minutes.`,
    impact: metrics.timingRisk < 30 ? "positive" : metrics.timingRisk < 65 ? "warning" : "risk",
    severity: metrics.timingRisk,
  });

  evidence.push({
    label: "Thin low-power supporters",
    observation: `${stats.lowPowerVoucherCount}/${stats.uniqueVouchers} vouchers are both thinly supported in the sampled Commons graph and far below median estimated vouch power.`,
    impact: metrics.lowQualitySupportRisk < 30 ? "positive" : metrics.lowQualitySupportRisk < 65 ? "warning" : "risk",
    severity: metrics.lowQualitySupportRisk,
  });

  evidence.push({
    label: "Graph coverage",
    observation: `Second-hop Commons ledgers were loaded for ${Math.round(stats.graphCoverage * 100)}% of unique vouchers.`,
    impact: stats.graphCoverage >= 0.8 ? "positive" : stats.graphCoverage >= 0.5 ? "warning" : "risk",
    severity: roundScore((1 - stats.graphCoverage) * 100),
  });

  return evidence;
}
