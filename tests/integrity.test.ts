import assert from "node:assert/strict";
import test from "node:test";
import { buildSupporterProfiles, calculateIntegrityMetrics, calculateNetworkStats } from "../lib/integrity.ts";
import { rankVerdict } from "../lib/verdict.ts";
import type { CommonsLedger } from "../lib/integrity-types.ts";

function targetLedger(handles: string[], closeTiming = false): CommonsLedger {
  const now = Date.now();
  return {
    handle: "target",
    display: "Target",
    rank: 500,
    totalPoints: 300000,
    entries: handles.map((handle, index) => ({
      kind: "vouch",
      authorHandle: handle,
      authorAvatarUrl: null,
      points: 10000 + index * 500,
      tweetText: "vouch",
      tweetUrl: null,
      createdAt: new Date(now - index * (closeTiming ? 60_000 : 8 * 60 * 60_000)).toISOString(),
    })),
  };
}

function independentLedgers(handles: string[]): Map<string, CommonsLedger | null> {
  const map = new Map<string, CommonsLedger | null>();
  for (const [index, handle] of handles.entries()) {
    map.set(handle, {
      handle,
      display: handle,
      rank: 1000 + index,
      totalPoints: 50000,
      entries: Array.from({ length: 5 }, (_, j) => ({
        kind: "vouch" as const,
        authorHandle: `outside_${index}_${j}`,
        authorAvatarUrl: null,
        points: 8000 + j * 1000,
        tweetText: "vouch",
        tweetUrl: null,
        createdAt: new Date(Date.now() - (j + 1) * 86400000).toISOString(),
      })),
    });
  }
  return map;
}

function ringLedgers(handles: string[]): Map<string, CommonsLedger | null> {
  const map = new Map<string, CommonsLedger | null>();
  for (let index = 0; index < handles.length; index++) {
    const handle = handles[index]!;
    const prev = handles[(index + handles.length - 1) % handles.length]!;
    const next = handles[(index + 1) % handles.length]!;
    map.set(handle, {
      handle,
      display: handle,
      rank: 2000 + index,
      totalPoints: 12000,
      entries: [
        { kind: "vouch", authorHandle: prev, authorAvatarUrl: null, points: 3000, tweetText: "vouch", tweetUrl: null, createdAt: new Date().toISOString() },
        { kind: "vouch", authorHandle: next, authorAvatarUrl: null, points: 3000, tweetText: "vouch", tweetUrl: null, createdAt: new Date().toISOString() },
        { kind: "vouch", authorHandle: "target", authorAvatarUrl: null, points: 3000, tweetText: "vouch", tweetUrl: null, createdAt: new Date().toISOString() },
      ],
    });
  }
  return map;
}

function addSlashWave(target: CommonsLedger, count: number, closeTiming = true) {
  const now = Date.now();
  for (let index = 0; index < count; index++) {
    target.entries.push({
      kind: "slash",
      authorHandle: `slasher_${index}`,
      authorAvatarUrl: null,
      points: -(9000 + (index % 5) * 1000),
      tweetText: "slash",
      tweetUrl: null,
      createdAt: new Date(now - index * (closeTiming ? 75_000 : 6 * 60 * 60_000)).toISOString(),
    });
  }
}

function addIndependentSlasherLedgers(ledgers: Map<string, CommonsLedger | null>, count: number) {
  for (let index = 0; index < count; index++) {
    ledgers.set(`slasher_${index}`, {
      handle: `slasher_${index}`,
      display: `slasher_${index}`,
      rank: 6000 + index,
      totalPoints: 20000,
      entries: [
        { kind: "vouch", authorHandle: `outside_slasher_${index}`, authorAvatarUrl: null, points: 5000, tweetText: "vouch", tweetUrl: null, createdAt: new Date().toISOString() },
      ],
    });
  }
}

test("independent Commons supporters produce strong support integrity", () => {
  const handles = Array.from({ length: 12 }, (_, i) => `creator_${i}`);
  const target = targetLedger(handles, false);
  const ledgers = independentLedgers(handles);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);
  const metrics = calculateIntegrityMetrics(stats);

  assert.equal(stats.reciprocalVoucherCount, 0);
  assert.equal(stats.internalVoucherVouchEdges, 0);
  assert.ok(metrics.supportIntegrity >= 75);
  assert.ok(metrics.supportCoordinationRisk < 35);
  assert.ok(metrics.slashAttackRisk < 20);
});

test("rank-dependence context reconstructs estimated pre-ledger contribution", () => {
  const handles = Array.from({ length: 12 }, (_, i) => `creator_${i}`);
  const target = targetLedger(handles, false);
  const ledgers = independentLedgers(handles);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);

  assert.equal(stats.vouchPoints, 153000);
  assert.equal(stats.slashPoints, 0);
  assert.equal(stats.netLedgerImpact, 153000);
  assert.equal(stats.estimatedTargetBasePoints, 147000);
  assert.equal(Math.round(stats.estimatedNetSupportShare * 100), 51);
});

test("slashes reduce net support contribution without being treated as base score", () => {
  const handles = ["creator_a", "creator_b"];
  const target = targetLedger(handles, false);
  target.totalPoints = 120000;
  target.entries.push({ kind: "slash", authorHandle: "slasher", authorAvatarUrl: null, points: -5000, tweetText: "slash", tweetUrl: null, createdAt: new Date().toISOString() });
  const ledgers = independentLedgers(handles);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);

  assert.equal(stats.vouchPoints, 20500);
  assert.equal(stats.slashPoints, 5000);
  assert.equal(stats.netLedgerImpact, 15500);
  assert.equal(stats.estimatedTargetBasePoints, 104500);
});

test("closed reciprocal voucher ring produces high support coordination risk", () => {
  const handles = Array.from({ length: 12 }, (_, i) => `ring_${i}`);
  const target = targetLedger(handles, true);
  const ledgers = ringLedgers(handles);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);
  const metrics = calculateIntegrityMetrics(stats);

  assert.equal(stats.reciprocalVoucherCount, 12);
  assert.ok(stats.internalVoucherVouchEdges >= 12);
  assert.ok(stats.voucherLargestComponentShare >= 0.9);
  assert.ok(metrics.supportCoordinationRisk >= 60);
  assert.ok(metrics.supportIntegrity < 55);
  assert.equal(rankVerdict(metrics, stats), "SUPPORT_COORDINATION_RISK");
});

test("organic vouches plus mass slashing never produces a blanket likely-organic verdict", () => {
  const handles = Array.from({ length: 16 }, (_, i) => `creator_${i}`);
  const target = targetLedger(handles, false);
  addSlashWave(target, 80, true);
  const vouchPoints = target.entries.filter((entry) => entry.kind === "vouch").reduce((sum, entry) => sum + Math.abs(entry.points), 0);
  const slashPoints = target.entries.filter((entry) => entry.kind === "slash").reduce((sum, entry) => sum + Math.abs(entry.points), 0);
  target.totalPoints = 220000 + vouchPoints - slashPoints;

  const ledgers = independentLedgers(handles);
  addIndependentSlasherLedgers(ledgers, 30);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);
  const metrics = calculateIntegrityMetrics(stats);
  const verdict = rankVerdict(metrics, stats);

  assert.ok(metrics.supportIntegrity >= 65, `support integrity ${metrics.supportIntegrity}`);
  assert.ok(metrics.attackPressure >= 65, `attack pressure ${metrics.attackPressure}`);
  assert.ok(metrics.rankDistortionRisk >= 55, `rank distortion ${metrics.rankDistortionRisk}`);
  assert.notEqual(verdict, "LIKELY_ORGANIC");
  assert.ok(["HEAVY_SLASH_PRESSURE", "SLASH_ATTACK_RISK"].includes(verdict), verdict);
});

test("slasher ring is measured independently from voucher ring", () => {
  const handles = Array.from({ length: 12 }, (_, i) => `creator_${i}`);
  const target = targetLedger(handles, false);
  addSlashWave(target, 18, true);
  const ledgers = independentLedgers(handles);
  const slasherHandles = Array.from({ length: 18 }, (_, i) => `slasher_${i}`);
  const slasherRing = ringLedgers(slasherHandles);
  for (const [key, ledger] of slasherRing) ledgers.set(key, ledger);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);
  const metrics = calculateIntegrityMetrics(stats);

  assert.ok(stats.internalSlasherVouchEdges >= 18);
  assert.ok(stats.slasherLargestComponentShare >= 0.9);
  assert.ok(metrics.attackCoordinationRisk >= 50);
  assert.ok(metrics.botSybilNetworkRisk >= 25);
});
