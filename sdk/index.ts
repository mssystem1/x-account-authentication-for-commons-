import type { IntegrityAuditResult } from "../lib/integrity-types.ts";

export interface VouchGuardClientOptions {
  baseUrl?: string;
}

export class VouchGuardClient {
  private readonly baseUrl: string;

  constructor(options: VouchGuardClientOptions = {}) {
    this.baseUrl = (options.baseUrl || "http://localhost:3000").replace(/\/$/, "");
  }

  async auditCreator(handle: string, options: { refresh?: boolean } = {}): Promise<IntegrityAuditResult> {
    const response = await fetch(`${this.baseUrl}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, refresh: Boolean(options.refresh) }),
    });

    const payload = await response.json() as IntegrityAuditResult | { error?: string };
    if (!response.ok) {
      throw new Error("error" in payload && payload.error ? payload.error : `VouchGuard request failed (${response.status}).`);
    }
    return payload as IntegrityAuditResult;
  }

  /** Backwards-compatible alias. */
  async scanAccount(handle: string, options: { refresh?: boolean } = {}): Promise<IntegrityAuditResult> {
    return this.auditCreator(handle, options);
  }

  async health(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/api/health`, { cache: "no-store" });
    if (!response.ok) throw new Error(`VouchGuard health check failed (${response.status}).`);
    return response.json() as Promise<Record<string, unknown>>;
  }
}

export type { IntegrityAuditResult } from "../lib/integrity-types.ts";
