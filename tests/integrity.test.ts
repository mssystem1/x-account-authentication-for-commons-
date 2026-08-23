import assert from "node:assert/strict";
import test from "node:test";
import { buildSupporterProfiles, calculateIntegrityMetrics, calculateNetworkStats } from "../lib/integrity.ts";
import type { CommonsLedger } from "../lib/integrity-types.ts";

function targetLedger(handles: string[], closeTiming = false): CommonsLedger {
  const now = Date.now();
  return {
    handle: "target",
    display: "Target",
    rank: 500,
    totalPoints: 100000,
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

test("independent Commons supporters produce strong organic score", () => {
  const handles = Array.from({ length: 12 }, (_, i) => `creator_${i}`);
  const target = targetLedger(handles, false);
  const ledgers = independentLedgers(handles);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);
  const metrics = calculateIntegrityMetrics(stats);

  assert.equal(stats.reciprocalVoucherCount, 0);
  assert.equal(stats.internalVouchEdges, 0);
  assert.ok(metrics.organicSupport >= 75);
  assert.ok(metrics.coordinationRisk < 35);
});

test("closed reciprocal ring produces high coordination risk", () => {
  const handles = Array.from({ length: 12 }, (_, i) => `ring_${i}`);
  const target = targetLedger(handles, true);
  const ledgers = ringLedgers(handles);
  const profiles = buildSupporterProfiles(target, ledgers);
  const stats = calculateNetworkStats(target, ledgers, profiles);
  const metrics = calculateIntegrityMetrics(stats);

  assert.equal(stats.reciprocalVoucherCount, 12);
  assert.ok(stats.internalVouchEdges >= 12);
  assert.ok(stats.largestComponentShare >= 0.9);
  assert.ok(metrics.coordinationRisk >= 70);
  assert.ok(metrics.botSybilSupportRisk >= 65);
  assert.ok(metrics.integrityScore < 50);
});
