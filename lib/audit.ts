import { fetchCommonsLedger } from "./commons.ts";
import { buildGrokIntegrityReport } from "./grok-integrity.ts";
import { buildIntegrityEvidence, buildSupporterProfiles, calculateIntegrityMetrics, calculateNetworkStats } from "./integrity.ts";
import type { CommonsActionKind, CommonsLedger, IntegrityAuditResult } from "./integrity-types.ts";
import { appOrigin, normalizeHandle } from "./utils.ts";
import { isFreshIntegrityAudit, readIntegrityAudit, writeIntegrityAudit } from "./storage.ts";

export const INTEGRITY_METHODOLOGY_VERSION = "vg-commons-2026.08.3";
const MAX_VOUCH_SECOND_HOP = 30;
const MAX_SLASH_SECOND_HOP = 30;
const CONCURRENCY = 6;

async function mapConcurrent<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function secondHopHandlesForAction(target: CommonsLedger, kind: CommonsActionKind, limit: number): string[] {
  const rows = new Map<string, { handle: string; impact: number; latest: number }>();
  for (const entry of target.entries) {
    if (entry.kind !== kind) continue;
    const key = entry.authorHandle.toLowerCase();
    const timestamp = entry.createdAt ? Date.parse(entry.createdAt) : 0;
    const current = rows.get(key);
    if (!current) rows.set(key, { handle: entry.authorHandle, impact: Math.abs(entry.points), latest: Number.isFinite(timestamp) ? timestamp : 0 });
    else {
      current.impact = Math.max(current.impact, Math.abs(entry.points));
      current.latest = Math.max(current.latest, Number.isFinite(timestamp) ? timestamp : 0);
    }
  }

  const values = [...rows.values()];
  if (values.length <= limit) return values.map((row) => row.handle);

  // Split the sample between high-impact actors and recent actors. High-impact sampling captures
  // who moved the score most; recent sampling captures coordinated bursts that would otherwise be missed.
  const impactBudget = Math.ceil(limit * 0.60);
  const selected = new Map<string, string>();
  for (const row of [...values].sort((a, b) => b.impact - a.impact).slice(0, impactBudget)) {
    selected.set(row.handle.toLowerCase(), row.handle);
  }
  for (const row of [...values].sort((a, b) => b.latest - a.latest)) {
    if (selected.size >= limit) break;
    selected.set(row.handle.toLowerCase(), row.handle);
  }
  return [...selected.values()];
}

function secondHopHandles(target: CommonsLedger): string[] {
  const vouchers = secondHopHandlesForAction(target, "vouch", MAX_VOUCH_SECOND_HOP);
  const slashers = secondHopHandlesForAction(target, "slash", MAX_SLASH_SECOND_HOP);
  const union = new Map<string, string>();
  for (const handle of [...vouchers, ...slashers]) union.set(handle.toLowerCase(), handle);
  return [...union.values()];
}

function demoLedger(handle: string): { target: CommonsLedger; supporterLedgers: Map<string, CommonsLedger | null> } {
  const supportRing = /bot|sybil|ring|farm|swarm/i.test(handle);
  const attackVictim = /attack|victim|slashed/i.test(handle);
  const now = Date.now();
  const voucherCount = supportRing ? 12 : 14;
  const entries: CommonsLedger["entries"] = Array.from({ length: voucherCount }, (_, index) => ({
    kind: "vouch" as const,
    authorHandle: supportRing ? `ring_${index + 1}` : `creator_${index + 1}`,
    authorAvatarUrl: null,
    points: supportRing ? 5000 + (index % 3) * 500 : 12000 + index * 1100,
    tweetText: "Synthetic Commons vouch for test mode.",
    tweetUrl: null,
    createdAt: new Date(now - (supportRing ? index * 2 * 60_000 : index * 8 * 60 * 60_000)).toISOString(),
  }));

  if (attackVictim) {
    for (let index = 0; index < 28; index++) {
      entries.push({
        kind: "slash",
        authorHandle: `attacker_${index + 1}`,
        authorAvatarUrl: null,
        points: -(9000 + (index % 6) * 1800),
        tweetText: "Synthetic coordinated slash for test mode.",
        tweetUrl: null,
        createdAt: new Date(now - index * 90_000).toISOString(),
      });
    }
  }

  const vouchTotal = entries.filter((entry) => entry.kind === "vouch").reduce((sum, entry) => sum + Math.abs(entry.points), 0);
  const slashTotal = entries.filter((entry) => entry.kind === "slash").reduce((sum, entry) => sum + Math.abs(entry.points), 0);
  const base = attackVictim ? 180000 : 300000;
  const target: CommonsLedger = {
    handle,
    display: `@${handle}`,
    rank: attackVictim ? 94000 : supportRing ? 118 : 642,
    totalPoints: base + vouchTotal - slashTotal,
    entries,
  };
  const supporterLedgers = new Map<string, CommonsLedger | null>();

  for (let index = 0; index < voucherCount; index++) {
    const supporter = entries[index]!;
    const incoming = [] as CommonsLedger["entries"];
    if (supportRing) {
      const previous = entries[(index + voucherCount - 1) % voucherCount]!;
      const next = entries[(index + 1) % voucherCount]!;
      incoming.push({ ...previous, authorHandle: previous.authorHandle, points: 4900, createdAt: new Date(now - index * 2 * 60_000).toISOString() });
      incoming.push({ ...next, authorHandle: next.authorHandle, points: 5100, createdAt: new Date(now - index * 2 * 60_000).toISOString() });
      incoming.push({ ...supporter, authorHandle: handle, points: 5200, createdAt: new Date(now - index * 2 * 60_000).toISOString() });
    } else {
      for (let j = 0; j < 5; j++) incoming.push({ ...supporter, authorHandle: `outside_${index}_${j}`, points: 8000 + j * 900, createdAt: new Date(now - (index + j + 2) * 12 * 60 * 60_000).toISOString() });
    }
    supporterLedgers.set(supporter.authorHandle.toLowerCase(), {
      handle: supporter.authorHandle,
      display: supporter.authorHandle,
      rank: 1000 + index,
      totalPoints: 50000 + index * 2000,
      entries: incoming,
    });
  }

  if (attackVictim) {
    const attackEntries = entries.filter((entry) => entry.kind === "slash");
    for (let index = 0; index < attackEntries.length; index++) {
      const attacker = attackEntries[index]!;
      const previous = attackEntries[(index + attackEntries.length - 1) % attackEntries.length]!;
      const next = attackEntries[(index + 1) % attackEntries.length]!;
      supporterLedgers.set(attacker.authorHandle.toLowerCase(), {
        handle: attacker.authorHandle,
        display: attacker.authorHandle,
        rank: 7000 + index,
        totalPoints: 10000 + index * 300,
        entries: [
          { ...previous, kind: "vouch", authorHandle: previous.authorHandle, points: 2500, createdAt: new Date(now - index * 90_000).toISOString() },
          { ...next, kind: "vouch", authorHandle: next.authorHandle, points: 2500, createdAt: new Date(now - index * 90_000).toISOString() },
        ],
      });
    }
  }

  return { target, supporterLedgers };
}

export async function auditCommonsCreator(input: string, refresh = false): Promise<IntegrityAuditResult> {
  const handle = normalizeHandle(input);

  if (!refresh) {
    const cached = await readIntegrityAudit(handle);
    if (cached && cached.methodologyVersion === INTEGRITY_METHODOLOGY_VERSION && isFreshIntegrityAudit(cached)) {
      return { ...cached, cached: true, permalink: `${appOrigin()}/u/${handle}` };
    }
  }

  const demo = process.env.VOUCHGUARD_DEMO_MODE === "true";
  let target: CommonsLedger;
  let supporterLedgers: Map<string, CommonsLedger | null>;

  if (demo) {
    ({ target, supporterLedgers } = demoLedger(handle));
  } else {
    target = await fetchCommonsLedger(handle);
    const handles = secondHopHandles(target);
    supporterLedgers = new Map();
    const rows = await mapConcurrent(handles, CONCURRENCY, async (supporterHandle) => {
      try {
        return [supporterHandle.toLowerCase(), await fetchCommonsLedger(supporterHandle)] as const;
      } catch (error) {
        console.warn(`Could not load Commons second-hop ledger for @${supporterHandle}:`, error);
        return [supporterHandle.toLowerCase(), null] as const;
      }
    });
    for (const [key, ledger] of rows) supporterLedgers.set(key, ledger);
  }

  const supporters = buildSupporterProfiles(target, supporterLedgers);
  const stats = calculateNetworkStats(target, supporterLedgers, supporters);
  const metrics = calculateIntegrityMetrics(stats);
  const evidence = buildIntegrityEvidence(stats, metrics);
  const report = await buildGrokIntegrityReport({
    handle: target.handle,
    rank: target.rank,
    totalPoints: target.totalPoints,
    metrics,
    stats,
    supporters,
    evidence,
  });

  const result: IntegrityAuditResult = {
    id: `${handle.toLowerCase()}-${Date.now()}`,
    handle: target.handle || handle,
    createdAt: new Date().toISOString(),
    mode: demo ? "demo" : "live",
    methodologyVersion: INTEGRITY_METHODOLOGY_VERSION,
    commons: { rank: target.rank, totalPoints: target.totalPoints, display: target.display },
    metrics,
    stats,
    supporters,
    evidence,
    report,
    sourceEntries: target.entries.slice().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    cached: false,
    permalink: `${appOrigin()}/u/${handle}`,
  };

  await writeIntegrityAudit(result).catch((error) => console.error("VouchGuard integrity cache write failed", error));
  return result;
}
