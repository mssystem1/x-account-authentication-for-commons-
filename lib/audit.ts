import { fetchCommonsLedger } from "./commons.ts";
import { buildGrokIntegrityReport } from "./grok-integrity.ts";
import { buildIntegrityEvidence, buildSupporterProfiles, calculateIntegrityMetrics, calculateNetworkStats } from "./integrity.ts";
import type { CommonsLedger, IntegrityAuditResult } from "./integrity-types.ts";
import { appOrigin, normalizeHandle } from "./utils.ts";
import { isFreshIntegrityAudit, readIntegrityAudit, writeIntegrityAudit } from "./storage.ts";

export const INTEGRITY_METHODOLOGY_VERSION = "vg-commons-2026.08.1";
const MAX_SECOND_HOP = 40;
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

function secondHopHandles(target: CommonsLedger): string[] {
  const byHandle = new Map<string, { handle: string; priority: number; vouch: boolean }>();
  for (const entry of target.entries) {
    const key = entry.authorHandle.toLowerCase();
    const current = byHandle.get(key);
    const priority = Math.abs(entry.points);
    if (!current) byHandle.set(key, { handle: entry.authorHandle, priority, vouch: entry.kind === "vouch" });
    else {
      current.priority = Math.max(current.priority, priority);
      current.vouch ||= entry.kind === "vouch";
    }
  }
  return [...byHandle.values()]
    .sort((a, b) => Number(b.vouch) - Number(a.vouch) || b.priority - a.priority)
    .slice(0, MAX_SECOND_HOP)
    .map((row) => row.handle);
}

function demoLedger(handle: string): { target: CommonsLedger; supporterLedgers: Map<string, CommonsLedger | null> } {
  const risky = /bot|sybil|ring|farm|swarm/i.test(handle);
  const now = Date.now();
  const voucherCount = risky ? 12 : 14;
  const entries = Array.from({ length: voucherCount }, (_, index) => ({
    kind: "vouch" as const,
    authorHandle: risky ? `ring_${index + 1}` : `creator_${index + 1}`,
    authorAvatarUrl: null,
    points: risky ? 5000 + (index % 3) * 500 : 12000 + index * 1100,
    tweetText: "Synthetic Commons vouch for test mode.",
    tweetUrl: null,
    createdAt: new Date(now - (risky ? index * 2 * 60_000 : index * 8 * 60 * 60_000)).toISOString(),
  }));
  const target: CommonsLedger = { handle, display: `@${handle}`, rank: risky ? 118 : 642, totalPoints: risky ? 410000 : 188000, entries };
  const supporterLedgers = new Map<string, CommonsLedger | null>();
  for (let index = 0; index < voucherCount; index++) {
    const supporter = entries[index]!;
    const incoming = [] as CommonsLedger["entries"];
    if (risky) {
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
  return { target, supporterLedgers };
}

export async function auditCommonsCreator(input: string, refresh = false): Promise<IntegrityAuditResult> {
  const handle = normalizeHandle(input);

  if (!refresh) {
    const cached = await readIntegrityAudit(handle);
    if (cached && isFreshIntegrityAudit(cached)) {
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
