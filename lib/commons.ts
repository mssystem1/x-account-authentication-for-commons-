import type { CommonsLedger, CommonsLedgerEntry } from "./integrity-types.ts";

const COMMONS_API = "https://api.commonsmade.com/game/events/genesis/targets";

interface RawLedgerEntry {
  kind?: unknown;
  author_handle?: unknown;
  author_avatar_url?: unknown;
  points?: unknown;
  tweet_text?: unknown;
  tweet_url?: unknown;
  tweet_created_at?: unknown;
}

interface RawLedger {
  x_handle?: unknown;
  display?: unknown;
  rank?: unknown;
  total_points?: unknown;
  entries?: unknown;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseEntry(value: unknown): CommonsLedgerEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as RawLedgerEntry;
  const kind = row.kind === "vouch" || row.kind === "slash" ? row.kind : null;
  const authorHandle = stringOrNull(row.author_handle);
  if (!kind || !authorHandle) return null;

  return {
    kind,
    authorHandle: authorHandle.replace(/^@/, ""),
    authorAvatarUrl: stringOrNull(row.author_avatar_url),
    points: finiteNumber(row.points),
    tweetText: stringOrNull(row.tweet_text) ?? "",
    tweetUrl: stringOrNull(row.tweet_url),
    createdAt: stringOrNull(row.tweet_created_at),
  };
}

function parseLedger(raw: RawLedger, requestedHandle: string): CommonsLedger {
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(parseEntry).filter((entry): entry is CommonsLedgerEntry => Boolean(entry))
    : [];

  return {
    handle: (stringOrNull(raw.x_handle) ?? requestedHandle).replace(/^@/, ""),
    display: stringOrNull(raw.display),
    rank: typeof raw.rank === "number" && Number.isFinite(raw.rank) ? Math.round(raw.rank) : null,
    totalPoints: finiteNumber(raw.total_points),
    entries,
  };
}

export async function fetchCommonsLedger(handle: string): Promise<CommonsLedger> {
  const url = `${COMMONS_API}/${encodeURIComponent(handle)}/ledger`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "VouchGuard-AI/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404 || response.status === 422) {
      throw new Error(`@${handle} was not found in the Commons genesis event.`);
    }
    if (response.status === 429) {
      throw new Error("Commons API rate limit reached. Try again shortly.");
    }
    if (!response.ok) {
      throw new Error(`Commons ledger request failed with HTTP ${response.status}.`);
    }

    return parseLedger(await response.json() as RawLedger, handle);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Commons ledger request timed out. Try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
