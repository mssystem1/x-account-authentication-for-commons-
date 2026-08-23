import { head, put } from "@vercel/blob";
import type { ScanResult } from "./types.ts";

const CACHE_PREFIX = "vouchguard/scans/v1";

function pathname(handle: string): string {
  return `${CACHE_PREFIX}/${handle.toLowerCase()}.json`;
}

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readCachedScan(handle: string): Promise<ScanResult | null> {
  if (!blobConfigured()) return null;
  try {
    const metadata = await head(pathname(handle));
    const response = await fetch(metadata.url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ScanResult;
  } catch {
    return null;
  }
}

export async function writeCachedScan(result: ScanResult): Promise<void> {
  if (!blobConfigured()) return;
  await put(pathname(result.handle), JSON.stringify(result), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export function isFresh(result: ScanResult): boolean {
  const ttlSeconds = Math.max(60, Number(process.env.SCAN_CACHE_TTL_SECONDS || 21600));
  return Date.now() - new Date(result.createdAt).getTime() < ttlSeconds * 1000;
}
