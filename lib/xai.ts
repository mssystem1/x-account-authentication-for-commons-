import { INVESTIGATION_JSON_SCHEMA, parseGrokInvestigation } from "./schema.ts";
import { accountSamplePrompt, investigationPrompt } from "./prompt.ts";
import type { GrokInvestigation, RetrievalMode } from "./types.ts";
import { fetchXAccountSample } from "./x-api.ts";

interface XaiResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
}

interface InvestigationRun {
  investigation: GrokInvestigation;
  xSearchCalls: number;
  webSearchCalls: number;
  retrievalMode: RetrievalMode;
  directTargetSources: number;
  retrievedPosts?: number;
  analysisSampleSize?: number;
  identityCacheHit?: boolean;
  estimatedXReadCostUsd?: number;
}

function responseText(response: XaiResponse): string {
  if (response.output_text?.trim()) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) return content.text;
    }
  }
  throw new Error("xAI returned no structured output text.");
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countToolCalls(response: XaiResponse, type: "x_search_call" | "web_search_call"): number {
  return (response.output ?? []).filter((item) => item.type === type).length;
}

function directTargetSourceCount(investigation: GrokInvestigation, handle: string): number {
  const target = handle.toLowerCase();
  const urls = investigation.evidence.flatMap((item) => item.sourceUrls);
  const direct = new Set<string>();

  for (const value of urls) {
    try {
      const url = new URL(value);
      if (!/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(url.hostname)) continue;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 3 && parts[0]?.toLowerCase() === target && parts[1]?.toLowerCase() === "status") {
        direct.add(url.toString());
      }
    } catch {
      // Source URLs were already sanitized by the schema parser; ignore malformed leftovers defensively.
    }
  }

  return direct.size;
}

function hasMinimumCoverage(investigation: GrokInvestigation): boolean {
  return investigation.coverage.profileResolved &&
    investigation.coverage.postsObserved >= 5 &&
    investigation.coverage.sufficiency !== "insufficient";
}

function enforceRecoveryEvidence(run: InvestigationRun): InvestigationRun {
  if (run.retrievalMode !== "recovery" || run.directTargetSources > 0) return run;

  run.investigation.coverage.sufficiency = "insufficient";
  run.investigation.confidence = Math.min(run.investigation.confidence, 0.25);
  run.investigation.coverage.note = `${run.investigation.coverage.note} Recovery search did not provide a verifiable direct post URL authored by the requested handle.`;
  run.investigation.uncertainties = [
    "Recovery search could not provide a direct target-post URL, so VouchGuard refused to score the account.",
    ...run.investigation.uncertainties,
  ].slice(0, 8);
  return run;
}

async function analyzeOfficialXSample(handle: string, model: string): Promise<InvestigationRun> {
  const sample = await fetchXAccountSample(handle);
  const diagnostics = {
    retrievedPosts: sample.rawPostsRetrieved,
    analysisSampleSize: sample.posts.length,
    identityCacheHit: sample.identityCacheHit,
    estimatedXReadCostUsd: sample.estimatedXReadCostUsd,
  };

  if (sample.coverage.sufficiency === "insufficient") {
    return {
      investigation: {
        profile: sample.profile,
        coverage: sample.coverage,
        metrics: {
          contentOriginality: 0,
          identityContinuity: 0,
          engagementQuality: 0,
          socialDiversity: 0,
          campaignConcentration: 0,
          reciprocityPressure: 0,
          automationPattern: 0,
          temporalAnomalies: 0,
          networkCoordination: 0,
        },
        evidence: [],
        summary: `The official X API resolved @${sample.account.username}, but there was not enough public authored activity in the analysis window to score the account reliably.`,
        confidence: 0.1,
        uncertainties: [sample.coverage.note],
      },
      xSearchCalls: 0,
      webSearchCalls: 0,
      retrievalMode: "x-api",
      directTargetSources: 0,
      ...diagnostics,
    };
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: accountSamplePrompt(sample),
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "vouchguard_account_investigation",
            schema: INVESTIGATION_JSON_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as XaiResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `xAI request failed with HTTP ${response.status}.`);
    }

    const investigation = parseGrokInvestigation(JSON.parse(responseText(payload)) as unknown, sample.account.username);
    investigation.profile = sample.profile;
    investigation.coverage = sample.coverage;

    // A five-post quick scan is intentionally cost-bounded. Even when the model is
    // very certain, do not present the same confidence as a much larger benchmark sample.
    investigation.confidence = Math.min(investigation.confidence, 0.78);

    const allowedUrls = new Set(sample.posts.map((post) => post.url));
    for (const item of investigation.evidence) {
      item.sourceUrls = item.sourceUrls.filter((url) => allowedUrls.has(url));
    }

    const directSources = directTargetSourceCount(investigation, sample.account.username);
    if (directSources < 1) {
      investigation.confidence = Math.min(investigation.confidence, 0.4);
      investigation.uncertainties = [
        "Grok analyzed an official X API sample but did not attach a supplied target-post URL to any evidence item.",
        ...investigation.uncertainties,
      ].slice(0, 8);
    }

    return {
      investigation,
      xSearchCalls: 0,
      webSearchCalls: 0,
      retrievalMode: "x-api",
      directTargetSources: directSources,
      ...diagnostics,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Grok timed out while analyzing the deterministic X API sample. Try the scan again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runNativeInvestigation(
  handle: string,
  model: string,
  days: number,
  maxTurns: number,
  timeoutMs: number,
  depth: "standard" | "fallback",
  retrievalMode: "scoped" | "recovery",
): Promise<InvestigationRun> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured.");

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const xSearchTool = retrievalMode === "scoped"
    ? {
        type: "x_search",
        allowed_x_handles: [handle],
        from_date: isoDate(from),
        to_date: isoDate(to),
      }
    : {
        type: "x_search",
        from_date: isoDate(from),
        to_date: isoDate(to),
      };

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: investigationPrompt(handle, isoDate(from), isoDate(to), depth, retrievalMode),
        reasoning: { effort: "low" },
        max_turns: maxTurns,
        tools: [xSearchTool],
        text: {
          format: {
            type: "json_schema",
            name: "vouchguard_account_investigation",
            schema: INVESTIGATION_JSON_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as XaiResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `xAI request failed with HTTP ${response.status}.`);
    }

    const raw = JSON.parse(responseText(payload)) as unknown;
    const investigation = parseGrokInvestigation(raw, handle);
    const run: InvestigationRun = {
      investigation,
      xSearchCalls: countToolCalls(payload, "x_search_call"),
      webSearchCalls: 0,
      retrievalMode,
      directTargetSources: directTargetSourceCount(investigation, handle),
    };
    return enforceRecoveryEvidence(run);
  } finally {
    clearTimeout(timeout);
  }
}

async function investigateWithNativeXSearch(handle: string, model: string): Promise<InvestigationRun> {
  let scoped: InvestigationRun | null = null;
  try {
    scoped = await runNativeInvestigation(handle, model, 120, 2, 14_000, "fallback", "scoped");
    if (hasMinimumCoverage(scoped.investigation)) return scoped;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    console.warn(`VouchGuard scoped X Search timed out for @${handle}; switching to recovery search.`);
  }

  const scopedReason = scoped
    ? `Scoped X Search returned ${scoped.investigation.coverage.postsObserved} direct posts and ${scoped.investigation.coverage.sufficiency} coverage.`
    : "Scoped X Search exceeded its latency budget.";

  try {
    const recovery = await runNativeInvestigation(handle, model, 180, 3, 28_000, "standard", "recovery");
    recovery.investigation.uncertainties = [
      `${scopedReason} VouchGuard used unscoped exact-author X recovery search.`,
      ...recovery.investigation.uncertainties,
    ].slice(0, 8);
    recovery.investigation.confidence = Math.min(recovery.investigation.confidence, 0.82);
    return recovery;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The xAI account investigation timed out during recovery search. Configure X_BEARER_TOKEN for deterministic production retrieval.");
    }
    throw error;
  }
}

export async function investigateWithGrok(handle: string): Promise<InvestigationRun & { model: string }> {
  if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY is not configured.");
  const model = process.env.XAI_MODEL || "grok-4.5-latest";

  if (process.env.X_BEARER_TOKEN?.trim()) {
    const result = await analyzeOfficialXSample(handle, model);
    return { ...result, model };
  }

  const fallback = await investigateWithNativeXSearch(handle, model);
  fallback.investigation.uncertainties = [
    "Official X API retrieval is not configured. This scan used xAI native X Search fallback, which may have coverage gaps for some accounts.",
    ...fallback.investigation.uncertainties,
  ].slice(0, 8);
  return { ...fallback, model };
}
