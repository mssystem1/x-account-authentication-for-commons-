import type { IntegrityMetrics, IntegrityVerdict, NetworkStats } from "./integrity-types.ts";

export function rankVerdict(metrics: IntegrityMetrics, stats: NetworkStats): IntegrityVerdict {
  if (stats.uniqueVouchers + stats.uniqueSlashers < 2) return "INSUFFICIENT_DATA";

  // Attack pressure is intentionally allowed to trigger a warning before we have enough graph
  // evidence to call the attackers coordinated. This fixes the old failure where a creator could
  // be massively slashed yet still receive a blanket "likely organic" result.
  if (metrics.supportCoordinationRisk >= 60 && metrics.slashAttackRisk >= 50) return "CONTESTED_MANIPULATION";
  if (metrics.slashAttackRisk >= 50) {
    return metrics.attackCoordinationRisk >= 35 && stats.slashGraphCoverage >= 0.20
      ? "SLASH_ATTACK_RISK"
      : "HEAVY_SLASH_PRESSURE";
  }

  if (metrics.supportCoordinationRisk >= 58) return "SUPPORT_COORDINATION_RISK";

  // A highly support-dependent rank needs materially better positive-graph coverage before it can
  // receive a strong organic verdict. This is particularly important for top-ranked accounts.
  if (stats.estimatedNetSupportShare >= 0.75 && (stats.vouchGraphCoverage < 0.40 || metrics.supportCoordinationRisk >= 25)) {
    return "SUPPORT_REVIEW";
  }

  if (
    metrics.supportIntegrity >= 75 &&
    metrics.supportCoordinationRisk < 35 &&
    metrics.slashAttackRisk < 40 &&
    (stats.uniqueVouchers < 8 || stats.vouchGraphCoverage >= 0.35)
  ) return "LIKELY_ORGANIC";

  return "SUPPORT_REVIEW";
}
