import { INVESTIGATION_JSON_SCHEMA, parseGrokInvestigation } from "./schema.ts";
import { investigationPrompt } from "./prompt.ts";
import type { GrokInvestigation, RetrievalMode } from "./types.ts";

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

async function runInvestigation(
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

  const tools = retrievalMode === "scoped"
    ? [xSearchTool]
    : [
        xSearchTool,
        {
          type: "web_search",
          filters: { allowed_domains: ["x.com", "twitter.com"] },
        },
      ];

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
        max_turns: maxTurns,
        tools,
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
      webSearchCalls: countToolCalls(payload, "web_search_call"),
      retrievalMode,
      directTargetSources: directTargetSourceCount(investigation, handle),
    };
    return enforceRecoveryEvidence(run);
  } finally {
    clearTimeout(timeout);
  }
}

export async function investigateWithGrok(handle: string): Promise<InvestigationRun & { model: string }> {
  if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY is not configured.");
  const model = process.env.XAI_MODEL || "grok-4.5-latest";

  let scoped: InvestigationRun | null = null;
  try {
    scoped = await runInvestigation(handle, model, 180, 3, 26_000, "standard", "scoped");
    if (hasMinimumCoverage(scoped.investigation)) return { ...scoped, model };
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    console.warn(`VouchGuard scoped X Search timed out for @${handle}; switching to recovery search.`);
  }

  const scopedReason = scoped
    ? `Scoped X Search returned ${scoped.investigation.coverage.postsObserved} direct posts and ${scoped.investigation.coverage.sufficiency} coverage.`
    : "Scoped X Search exceeded its latency budget.";

  try {
    const recovery = await runInvestigation(
      handle,
      model,
      scoped ? 180 : 90,
      scoped ? 4 : 2,
      scoped ? 27_000 : 20_000,
      scoped ? "standard" : "fallback",
      "recovery",
    );
    recovery.investigation.uncertainties = [
      `${scopedReason} VouchGuard used exact-author recovery search.`,
      ...recovery.investigation.uncertainties,
    ].slice(0, 8);

    if (!scoped) {
      recovery.investigation.confidence = Math.min(recovery.investigation.confidence, 0.68);
      if (recovery.investigation.coverage.sufficiency === "sufficient") {
        recovery.investigation.coverage.sufficiency = "limited";
        recovery.investigation.coverage.note = `${recovery.investigation.coverage.note} Coverage downgraded because the scoped pass timed out.`;
      }
    }

    return { ...recovery, model };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The xAI account investigation timed out during recovery search. Try the scan again.");
    }
    throw error;
  }
}
