import { head, put } from "@vercel/blob";
import type { ScanResult } from "./types.ts";

const CACHE_PREFIX = "vouchguard/scans/v3";
const X_IDENTITY_PREFIX = "vouchguard/x-identities/v1";
const X_IDENTITY_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedXIdentity {
  id: string;
  username: string;
  name: string;
  createdAt?: string;
  description?: string;
  protected: boolean;
  verified: boolean;
  followers: number;
  following: number;
  totalPosts: number;
  listed: number;
  resolvedAt: string;
}

function scanPathname(handle: string): string {
  return `${CACHE_PREFIX}/${handle.toLowerCase()}.json`;
}

function identityPathname(handle: string): string {
  return `${X_IDENTITY_PREFIX}/${handle.toLowerCase()}.json`;
}

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readJsonBlob<T>(pathname: string): Promise<T | null> {
  if (!blobConfigured()) return null;
  try {
    const metadata = await head(pathname);
    const response = await fetch(metadata.url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function writeJsonBlob(pathname: string, value: unknown): Promise<void> {
  if (!blobConfigured()) return;
  await put(pathname, JSON.stringify(value), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function readCachedScan(handle: string): Promise<ScanResult | null> {
  return readJsonBlob<ScanResult>(scanPathname(handle));
}

export async function writeCachedScan(result: ScanResult): Promise<void> {
  await writeJsonBlob(scanPathname(result.handle), result);
}

export async function readCachedXIdentity(handle: string): Promise<CachedXIdentity | null> {
  const identity = await readJsonBlob<CachedXIdentity>(identityPathname(handle));
  if (!identity) return null;
  const resolvedAt = new Date(identity.resolvedAt).getTime();
  if (!Number.isFinite(resolvedAt) || Date.now() - resolvedAt > X_IDENTITY_TTL_MS) return null;
  return identity;
}

export async function writeCachedXIdentity(handle: string, identity: CachedXIdentity): Promise<void> {
  await writeJsonBlob(identityPathname(handle), identity);
}

export function isFresh(result: ScanResult): boolean {
  const ttlSeconds = Math.max(60, Number(process.env.SCAN_CACHE_TTL_SECONDS || 21600));
  return Date.now() - new Date(result.createdAt).getTime() < ttlSeconds * 1000;
}
