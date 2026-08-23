import type {
  CommonsActionKind,
  CommonsLedger,
  IntegrityEvidence,
  IntegrityMetrics,
  IntegrityVerdict,
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
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

function riskScale(value: number, start: number, full: number): number {
  if (value <= start) return 0;
  if (value >= full) return 100;
  return ((value - start) / (full - start)) * 100;
}

function actionEntries(target: CommonsLedger, kind: CommonsActionKind) {
  return target.entries.filter((entry) => entry.kind === kind);
}

function actionHandles(target: CommonsLedger, kind: CommonsActionKind): string[] {
  return [...new Set(actionEntries(target, kind).map((entry) => entry.authorHandle.toLowerCase()))];
}

function actionPointShares(target: CommonsLedger, kind: CommonsActionKind) {
  const byActor = new Map<string, number>();
  for (const entry of actionEntries(target, kind)) {
    const key = entry.authorHandle.toLowerCase();
    byActor.set(key, (byActor.get(key) ?? 0) + Math.abs(entry.points));
  }
  const values = [...byActor.values()].sort((a, b) => b - a);
  const total = values.reduce((sum, value) => sum + value, 0);
  const shares = values.map((value) => ratio(value, total));
  return {
    top1: shares[0] ?? 0,
    top5: shares.slice(0, 5).reduce((sum, value) => sum + value, 0),
    hhi: shares.reduce((sum, value) => sum + value * value, 0),
  };
}

function timestampsFor(target: CommonsLedger, kind: CommonsActionKind): number[] {
  return actionEntries(target, kind)
    .map((entry) => entry.createdAt ? Date.parse(entry.createdAt) : NaN)
    .filter((value) => Number.isFinite(value));
}

export function buildSupporterProfiles(
  target: CommonsLedger,
  supporterLedgers: Map<string, CommonsLedger | null>,
): SupporterProfile[] {
  const voucherSet = new Set(actionHandles(target, "vouch"));
  const slasherSet = new Set(actionHandles(target, "slash"));
  const grouped = new Map<string, { handle: string; action: CommonsActionKind; points: number; maxAbsPoints: number }>();

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
    const peerSet = row.action === "vouch" ? voucherSet : slasherSet;
    const incomingVouches = ledger?.entries.filter((entry) => entry.kind === "vouch").length ?? 0;
    const incomingSlashes = ledger?.entries.filter((entry) => entry.kind === "slash").length ?? 0;
    const uniqueIncomingActors = ledger ? new Set(ledger.entries.map((entry) => entry.authorHandle.toLowerCase())).size : 0;
    const targetHandle = target.handle.toLowerCase();
    const reciprocatedByTarget = row.action === "vouch" && Boolean(ledger?.entries.some(
      (entry) => entry.kind === "vouch" && entry.authorHandle.toLowerCase() === targetHandle,
    ));
    const retaliatedByTarget = row.action === "slash" && Boolean(ledger?.entries.some(
      (entry) => entry.kind === "slash" && entry.authorHandle.toLowerCase() === targetHandle,
    ));
    const internalVouchLinks = ledger?.entries.filter(
      (entry) => entry.kind === "vouch" && peerSet.has(entry.authorHandle.toLowerCase()) && entry.authorHandle.toLowerCase() !== row.handle.toLowerCase(),
    ).length ?? 0;
    const internalSlashLinks = ledger?.entries.filter(
      (entry) => entry.kind === "slash" && peerSet.has(entry.authorHandle.toLowerCase()) && entry.authorHandle.toLowerCase() !== row.handle.toLowerCase(),
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
      retaliatedByTarget,
      internalVouchLinks,
      internalSlashLinks,
      graphLoaded: Boolean(ledger),
    };
  }).sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

interface SideGraphStats {
  analyzed: number;
  coverage: number;
  internalVouchEdges: number;
  internalSlashEdges: number;
  largestComponentSize: number;
  largestComponentShare: number;
  edgeDensity: number;
  edgesPerAnalyzedActor: number;
  medianBase: number;
  thinCount: number;
  thinShare: number;
}

function calculateSideGraph(
  target: CommonsLedger,
  supporterLedgers: Map<string, CommonsLedger | null>,
  profiles: SupporterProfile[],
  kind: CommonsActionKind,
): SideGraphStats {
  const handles = actionHandles(target, kind);
  const handleSet = new Set(handles);
  const loadedRecipients = handles.filter((handle) => Boolean(supporterLedgers.get(handle)));
  const vouchEdges = new Set<string>();
  const slashEdges = new Set<string>();

  for (const recipient of loadedRecipients) {
    const ledger = supporterLedgers.get(recipient);
    if (!ledger) continue;
    for (const entry of ledger.entries) {
      const source = entry.authorHandle.toLowerCase();
      if (!handleSet.has(source) || source === recipient) continue;
      const edge = `${source}->${recipient}`;
      if (entry.kind === "vouch") vouchEdges.add(edge);
      if (entry.kind === "slash") slashEdges.add(edge);
    }
  }

  const components = connectedComponents(handles, [...vouchEdges].map((edge) => edge.split("->") as [string, string]));
  const largestComponentSize = components[0] ?? 0;
  const possibleObservedEdges = loadedRecipients.length * Math.max(0, handles.length - 1);
  const sideProfiles = profiles.filter((profile) => profile.action === kind);
  const bases = sideProfiles.map((profile) => profile.estimatedBasePoints).filter((value) => value > 0);
  const medianBase = median(bases);
  const thinThreshold = medianBase > 0 ? medianBase * 0.25 : 0;
  const thinCount = sideProfiles.filter((profile) => {
    if (!profile.graphLoaded) return false;
    const thinGraph = profile.uniqueIncomingActors <= 1;
    const lowPower = thinThreshold > 0 && profile.estimatedBasePoints < thinThreshold;
    return thinGraph && lowPower;
  }).length;

  return {
    analyzed: loadedRecipients.length,
    coverage: ratio(loadedRecipients.length, handles.length),
    internalVouchEdges: vouchEdges.size,
    internalSlashEdges: slashEdges.size,
    largestComponentSize,
    largestComponentShare: ratio(largestComponentSize, handles.length),
    edgeDensity: ratio(vouchEdges.size, possibleObservedEdges),
    edgesPerAnalyzedActor: ratio(vouchEdges.size, loadedRecipients.length),
    medianBase: Math.round(medianBase),
    thinCount,
    thinShare: ratio(thinCount, loadedRecipients.length),
  };
}

export function calculateNetworkStats(
  target: CommonsLedger,
  supporterLedgers: Map<string, CommonsLedger | null>,
  profiles: SupporterProfile[],
): NetworkStats {
  const vouchEntries = actionEntries(target, "vouch");
  const slashEntries = actionEntries(target, "slash");
  const voucherHandles = actionHandles(target, "vouch");
  const slasherHandles = actionHandles(target, "slash");
  const voucherSet = new Set(voucherHandles);
  const slasherSet = new Set(slasherHandles);
  const vouchGraph = calculateSideGraph(target, supporterLedgers, profiles, "vouch");
  const slashGraph = calculateSideGraph(target, supporterLedgers, profiles, "slash");
  const vouchShares = actionPointShares(target, "vouch");
  const slashShares = actionPointShares(target, "slash");
  const vouchTimes = timestampsFor(target, "vouch");
  const slashTimes = timestampsFor(target, "slash");
  const vouchPoints = Math.round(vouchEntries.reduce((sum, entry) => sum + Math.abs(entry.points), 0));
  const slashPoints = Math.round(slashEntries.reduce((sum, entry) => sum + Math.abs(entry.points), 0));
  const netLedgerImpact = vouchPoints - slashPoints;
  const estimatedTargetBasePoints = Math.max(0, Math.round(target.totalPoints - netLedgerImpact));
  const positiveNetSupport = Math.max(0, netLedgerImpact);
  const estimatedNetSupportShare = target.totalPoints > 0 ? clamp(positiveNetSupport / target.totalPoints, 0, 1) : 0;
  const negativeActionShare = ratio(slashPoints, vouchPoints + slashPoints);
  const slashToBaseRatio = ratio(slashPoints, Math.max(1, Math.abs(estimatedTargetBasePoints)));
  const reciprocalVoucherCount = profiles.filter((profile) => profile.action === "vouch" && profile.reciprocatedByTarget).length;
  const targetSlashRetaliationCount = profiles.filter((profile) => profile.action === "slash" && profile.retaliatedByTarget).length;
  const overlapCount = [...voucherSet].filter((handle) => slasherSet.has(handle)).length;

  const maxVouches5m = maxEventsWithin(vouchTimes, 5 * 60 * 1000);
  const maxVouches15m = maxEventsWithin(vouchTimes, 15 * 60 * 1000);
  const maxVouches60m = maxEventsWithin(vouchTimes, 60 * 60 * 1000);
  const maxSlashes5m = maxEventsWithin(slashTimes, 5 * 60 * 1000);
  const maxSlashes15m = maxEventsWithin(slashTimes, 15 * 60 * 1000);
  const maxSlashes60m = maxEventsWithin(slashTimes, 60 * 60 * 1000);

  return {
    incomingVouches: vouchEntries.length,
    incomingSlashes: slashEntries.length,
    uniqueVouchers: voucherHandles.length,
    uniqueSlashers: slasherHandles.length,
    vouchPoints,
    slashPoints,
    netLedgerImpact,
    estimatedTargetBasePoints,
    estimatedNetSupportShare,
    negativeActionShare,
    slashToBaseRatio,
    voucherSlasherOverlapCount: overlapCount,
    analyzedVouchers: vouchGraph.analyzed,
    analyzedSlashers: slashGraph.analyzed,
    totalSupporters: new Set(target.entries.map((entry) => entry.authorHandle.toLowerCase())).size,
    vouchGraphCoverage: vouchGraph.coverage,
    slashGraphCoverage: slashGraph.coverage,
    reciprocalVoucherCount,
    reciprocalVoucherRatio: ratio(reciprocalVoucherCount, voucherHandles.length),
    targetSlashRetaliationCount,
    targetSlashRetaliationRatio: ratio(targetSlashRetaliationCount, slasherHandles.length),
    internalVoucherVouchEdges: vouchGraph.internalVouchEdges,
    internalVoucherSlashEdges: vouchGraph.internalSlashEdges,
    internalSlasherVouchEdges: slashGraph.internalVouchEdges,
    internalSlasherSlashEdges: slashGraph.internalSlashEdges,
    voucherLargestComponentSize: vouchGraph.largestComponentSize,
    voucherLargestComponentShare: vouchGraph.largestComponentShare,
    slasherLargestComponentSize: slashGraph.largestComponentSize,
    slasherLargestComponentShare: slashGraph.largestComponentShare,
    voucherEdgeDensity: vouchGraph.edgeDensity,
    slasherEdgeDensity: slashGraph.edgeDensity,
    voucherEdgesPerAnalyzedActor: vouchGraph.edgesPerAnalyzedActor,
    slasherEdgesPerAnalyzedActor: slashGraph.edgesPerAnalyzedActor,
    top1VouchPointShare: vouchShares.top1,
    top5VouchPointShare: vouchShares.top5,
    vouchPointHhi: vouchShares.hhi,
    top1SlashPointShare: slashShares.top1,
    top5SlashPointShare: slashShares.top5,
    slashPointHhi: slashShares.hhi,
    maxVouches5m,
    maxVouches15m,
    maxVouches60m,
    rapidVouch15mShare: ratio(maxVouches15m, vouchEntries.length),
    rapidVouch60mShare: ratio(maxVouches60m, vouchEntries.length),
    maxSlashes5m,
    maxSlashes15m,
    maxSlashes60m,
    rapidSlash15mShare: ratio(maxSlashes15m, slashEntries.length),
    rapidSlash60mShare: ratio(maxSlashes60m, slashEntries.length),
    medianVoucherEstimatedBasePoints: vouchGraph.medianBase,
    medianSlasherEstimatedBasePoints: slashGraph.medianBase,
    thinVoucherCount: vouchGraph.thinCount,
    thinVoucherShare: vouchGraph.thinShare,
    thinSlasherCount: slashGraph.thinCount,
    thinSlasherShare: slashGraph.thinShare,
  };
}

function pointConcentrationRisk(top1: number, top5: number, hhi: number): number {
  return roundScore(clamp(
    riskScale(top1, 0.18, 0.55) * 0.45 +
    riskScale(top5, 0.55, 0.95) * 0.35 +
    riskScale(hhi, 0.12, 0.45) * 0.20,
    0,
    100,
  ));
}

function calculateSupportTimingRisk(stats: NetworkStats): number {
  return roundScore(Math.max(
    riskScale(stats.maxVouches15m, 8, 25) * 0.75,
    riskScale(stats.maxVouches60m, 20, 60) * 0.65,
    riskScale(stats.rapidVouch15mShare, 0.20, 0.65),
  ));
}

function calculateAttackTimingRisk(stats: NetworkStats): number {
  return roundScore(clamp(
    riskScale(stats.maxSlashes5m, 3, 10) * 0.35 +
    riskScale(stats.maxSlashes15m, 6, 20) * 0.35 +
    riskScale(stats.maxSlashes60m, 12, 40) * 0.20 +
    riskScale(stats.rapidSlash15mShare, 0.05, 0.30) * 0.10,
    0,
    100,
  ));
}

export function calculateIntegrityMetrics(stats: NetworkStats): IntegrityMetrics {
  const supportReciprocityRisk = roundScore(clamp(stats.reciprocalVoucherRatio * 125, 0, 100));
  const supportTimingRisk = calculateSupportTimingRisk(stats);
  const supportConcentrationRisk = pointConcentrationRisk(stats.top1VouchPointShare, stats.top5VouchPointShare, stats.vouchPointHhi);
  const voucherComponentRisk = Math.max(
    riskScale(stats.voucherLargestComponentShare, 0.15, 0.55),
    riskScale(stats.voucherEdgesPerAnalyzedActor, 0.5, 3.0),
  );
  const supportCoordinationRisk = roundScore(clamp(
    voucherComponentRisk * 0.55 + supportReciprocityRisk * 0.20 + supportTimingRisk * 0.15 + supportConcentrationRisk * 0.10,
    0,
    100,
  ));
  const supportThinAccountRisk = roundScore(clamp(stats.thinVoucherShare * 140, 0, 100));
  const supportRaw = 100 - (
    supportCoordinationRisk * 0.50 + supportReciprocityRisk * 0.12 + supportConcentrationRisk * 0.12 + supportTimingRisk * 0.08 + supportThinAccountRisk * 0.18
  );
  const supportCoveragePenalty = stats.uniqueVouchers === 0
    ? 25
    : stats.vouchGraphCoverage >= 0.60 ? 0
      : stats.vouchGraphCoverage >= 0.40 ? 5
        : stats.vouchGraphCoverage >= 0.20 ? 12
          : 20;
  const supportIntegrity = roundScore(clamp(supportRaw - supportCoveragePenalty, 0, 100));

  const attackConcentrationRisk = pointConcentrationRisk(stats.top1SlashPointShare, stats.top5SlashPointShare, stats.slashPointHhi);
  const attackTimingRisk = calculateAttackTimingRisk(stats);
  const attackThinAccountRisk = roundScore(clamp(stats.thinSlasherShare * 140, 0, 100));
  const slasherComponentRisk = Math.max(
    riskScale(stats.slasherLargestComponentShare, 0.10, 0.50),
    riskScale(stats.slasherEdgesPerAnalyzedActor, 0.30, 2.50),
  );
  const attackCoordinationRisk = roundScore(clamp(
    slasherComponentRisk * 0.40 + attackTimingRisk * 0.30 + attackThinAccountRisk * 0.20 + attackConcentrationRisk * 0.10,
    0,
    100,
  ));

  const slashCountRisk = riskScale(stats.uniqueSlashers, 20, 120);
  const negativeShareRisk = riskScale(stats.negativeActionShare, 0.20, 0.60);
  const baseImpactRisk = riskScale(stats.slashToBaseRatio, 0.50, 5.0);
  const attackPressure = roundScore(clamp(
    slashCountRisk * 0.35 + negativeShareRisk * 0.45 + baseImpactRisk * 0.20,
    0,
    100,
  ));
  const slashAttackRisk = roundScore(clamp(attackPressure * 0.55 + attackCoordinationRisk * 0.45, 0, 100));

  const botSybilNetworkRisk = roundScore(clamp(
    attackCoordinationRisk * 0.55 + supportCoordinationRisk * 0.25 + Math.max(attackThinAccountRisk, supportThinAccountRisk) * 0.20,
    0,
    100,
  ));

  const supportDistortion = supportCoordinationRisk * stats.estimatedNetSupportShare;
  const attackDistortion = attackPressure * (0.55 + 0.45 * stats.negativeActionShare);
  const rankDistortionRisk = roundScore(clamp(Math.max(supportDistortion, attackDistortion), 0, 100));
  const rankReliability = roundScore(clamp(100 - rankDistortionRisk, 0, 100));

  return {
    supportIntegrity,
    supportCoordinationRisk,
    supportReciprocityRisk,
    supportConcentrationRisk,
    supportTimingRisk,
    supportThinAccountRisk,
    slashAttackRisk,
    attackPressure,
    attackCoordinationRisk,
    attackTimingRisk,
    attackConcentrationRisk,
    attackThinAccountRisk,
    botSybilNetworkRisk,
    rankDistortionRisk,
    rankReliability,
  };
}

export function deterministicVerdict(metrics: IntegrityMetrics, stats: NetworkStats): IntegrityVerdict {
  if (stats.uniqueVouchers + stats.uniqueSlashers < 2) return "INSUFFICIENT_DATA";
  if (metrics.supportCoordinationRisk >= 60 && metrics.slashAttackRisk >= 60) return "CONTESTED_MANIPULATION";
  if (metrics.slashAttackRisk >= 60) {
    return metrics.attackCoordinationRisk >= 35 && stats.slashGraphCoverage >= 0.20
      ? "SLASH_ATTACK_RISK"
      : "HEAVY_SLASH_PRESSURE";
  }
  if (metrics.supportCoordinationRisk >= 58) return "SUPPORT_COORDINATION_RISK";
  if (stats.estimatedNetSupportShare >= 0.75 && (stats.vouchGraphCoverage < 0.40 || metrics.supportCoordinationRisk >= 25)) return "SUPPORT_REVIEW";
  if (
    metrics.supportIntegrity >= 75 && metrics.supportCoordinationRisk < 35 && metrics.slashAttackRisk < 45 &&
    (stats.uniqueVouchers < 8 || stats.vouchGraphCoverage >= 0.35)
  ) return "LIKELY_ORGANIC";
  return "SUPPORT_REVIEW";
}

export function buildIntegrityEvidence(stats: NetworkStats, metrics: IntegrityMetrics): IntegrityEvidence[] {
  const evidence: IntegrityEvidence[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  evidence.push({ domain: "rank", label: "Rank dependence", observation: `Observed vouches added ${stats.vouchPoints.toLocaleString()} points and slashes removed ${stats.slashPoints.toLocaleString()}, for net ledger impact ${stats.netLedgerImpact >= 0 ? "+" : ""}${stats.netLedgerImpact.toLocaleString()}. Estimated pre-ledger/base contribution is ${stats.estimatedTargetBasePoints.toLocaleString()} points; positive net support represents about ${pct(stats.estimatedNetSupportShare)} of the current positive total.`, impact: metrics.rankDistortionRisk < 35 ? "positive" : metrics.rankDistortionRisk < 65 ? "warning" : "risk", severity: metrics.rankDistortionRisk });
  evidence.push({ domain: "support", label: "Voucher diversity", observation: `${stats.uniqueVouchers} unique vouchers contributed ${stats.vouchPoints.toLocaleString()} points.`, impact: stats.uniqueVouchers >= 8 ? "positive" : stats.uniqueVouchers >= 3 ? "warning" : "risk", severity: stats.uniqueVouchers >= 8 ? 15 : stats.uniqueVouchers >= 3 ? 45 : 75 });
  evidence.push({ domain: "support", label: "Reciprocal support", observation: `${stats.reciprocalVoucherCount} of ${stats.uniqueVouchers} unique vouchers appear to have been vouched back by the target (${pct(stats.reciprocalVoucherRatio)}).`, impact: metrics.supportReciprocityRisk < 30 ? "positive" : metrics.supportReciprocityRisk < 65 ? "warning" : "risk", severity: metrics.supportReciprocityRisk });
  evidence.push({ domain: "support", label: "Voucher community structure", observation: `Largest connected voucher component contains ${stats.voucherLargestComponentSize}/${stats.uniqueVouchers} vouchers (${pct(stats.voucherLargestComponentShare)}). ${stats.internalVoucherVouchEdges} positive links were observed inside the voucher set across ${stats.analyzedVouchers} loaded voucher ledgers.`, impact: metrics.supportCoordinationRisk < 30 ? "positive" : metrics.supportCoordinationRisk < 60 ? "warning" : "risk", severity: metrics.supportCoordinationRisk });
  evidence.push({ domain: "support", label: "Positive point concentration", observation: `Top voucher supplies ${pct(stats.top1VouchPointShare)} of vouch points; top five supply ${pct(stats.top5VouchPointShare)}.`, impact: metrics.supportConcentrationRisk < 30 ? "positive" : metrics.supportConcentrationRisk < 65 ? "warning" : "risk", severity: metrics.supportConcentrationRisk });
  evidence.push({ domain: "attack", label: "Slash pressure", observation: `${stats.uniqueSlashers} unique slashers removed ${stats.slashPoints.toLocaleString()} points. Slashes represent ${pct(stats.negativeActionShare)} of all observed absolute vouch/slash impact and about ${stats.slashToBaseRatio.toFixed(1)}× the estimated pre-ledger/base contribution.`, impact: metrics.attackPressure < 35 ? "positive" : metrics.attackPressure < 65 ? "warning" : "risk", severity: metrics.attackPressure });
  evidence.push({ domain: "attack", label: "Slash timing", observation: `Largest observed bursts: ${stats.maxSlashes5m} slashes in 5 minutes, ${stats.maxSlashes15m} in 15 minutes, and ${stats.maxSlashes60m} in 60 minutes.`, impact: metrics.attackTimingRisk < 30 ? "positive" : metrics.attackTimingRisk < 65 ? "warning" : "risk", severity: metrics.attackTimingRisk });
  evidence.push({ domain: "attack", label: "Slasher community structure", observation: `Largest connected slasher component contains ${stats.slasherLargestComponentSize}/${stats.uniqueSlashers} slashers (${pct(stats.slasherLargestComponentShare)}). ${stats.internalSlasherVouchEdges} positive links were observed among slashers across ${stats.analyzedSlashers} loaded slasher ledgers.`, impact: metrics.attackCoordinationRisk < 30 ? "positive" : metrics.attackCoordinationRisk < 60 ? "warning" : "risk", severity: metrics.attackCoordinationRisk });
  evidence.push({ domain: "attack", label: "Slash point concentration", observation: `Top slasher supplies ${pct(stats.top1SlashPointShare)} of removed points; top five supply ${pct(stats.top5SlashPointShare)}.`, impact: metrics.attackConcentrationRisk < 30 ? "positive" : metrics.attackConcentrationRisk < 65 ? "warning" : "risk", severity: metrics.attackConcentrationRisk });
  evidence.push({ domain: "attack", label: "Thin sampled slashers", observation: `${stats.thinSlasherCount}/${stats.analyzedSlashers} loaded slashers are both thinly supported in the Commons graph and far below the sampled median estimated action power.`, impact: metrics.attackThinAccountRisk < 30 ? "positive" : metrics.attackThinAccountRisk < 65 ? "warning" : "risk", severity: metrics.attackThinAccountRisk });

  const minRelevantCoverage = Math.min(stats.uniqueVouchers ? stats.vouchGraphCoverage : 1, stats.uniqueSlashers ? stats.slashGraphCoverage : 1);
  evidence.push({ domain: "coverage", label: "Graph coverage", observation: `Second-hop ledgers were loaded for ${stats.analyzedVouchers}/${stats.uniqueVouchers} vouchers (${pct(stats.vouchGraphCoverage)}) and ${stats.analyzedSlashers}/${stats.uniqueSlashers} slashers (${pct(stats.slashGraphCoverage)}). Low coverage reduces confidence and must never be interpreted as evidence that no coordination exists.`, impact: minRelevantCoverage >= 0.40 ? "positive" : "warning", severity: roundScore((1 - minRelevantCoverage) * 100) });
  return evidence;
}
