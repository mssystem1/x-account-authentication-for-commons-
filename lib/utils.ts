export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value));
}

export function normalizeHandle(input: string): string {
  const trimmed = input.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
  const firstSegment = trimmed.split(/[/?#]/)[0] ?? "";
  const handle = firstSegment.replace(/^@/, "");

  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    throw new Error("Enter a valid X handle (1–15 letters, numbers, or underscores). ");
  }

  return handle;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
