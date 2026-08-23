import { INVESTIGATION_JSON_SCHEMA, parseGrokInvestigation } from "./schema.ts";
import { investigationPrompt } from "./prompt.ts";
import type { GrokInvestigation } from "./types.ts";

interface XaiResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    num_server_side_tools_used?: number;
  };
  error?: { message?: string };
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

function countXSearchCalls(response: XaiResponse): number {
  const explicitCalls = (response.output ?? []).filter((item) => item.type === "x_search_call").length;
  const serverToolCount = typeof response.usage?.num_server_side_tools_used === "number"
    ? response.usage.num_server_side_tools_used
    : 0;
  return Math.max(explicitCalls, serverToolCount);
}

async function runInvestigation(
  handle: string,
  model: string,
  days: number,
  maxTurns: number,
  timeoutMs: number,
  depth: "standard" | "fallback",
): Promise<{ investigation: GrokInvestigation; xSearchCalls: number }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured.");

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: investigationPrompt(handle, isoDate(from), isoDate(to), depth),
        max_turns: maxTurns,
        tools: [
          {
            type: "x_search",
            allowed_x_handles: [handle],
            from_date: isoDate(from),
            to_date: isoDate(to),
          },
        ],
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
    return {
      investigation: parseGrokInvestigation(raw, handle),
      xSearchCalls: countXSearchCalls(payload),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function investigateWithGrok(handle: string): Promise<{ investigation: GrokInvestigation; model: string; xSearchCalls: number }> {
  if (!process.env.XAI_API_KEY) throw new Error("XAI_API_KEY is not configured.");
  const model = process.env.XAI_MODEL || "grok-4.5-latest";

  try {
    const standard = await runInvestigation(handle, model, 180, 4, 34_000, "standard");
    return { ...standard, model };
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
    console.warn(`VouchGuard standard xAI scan timed out for @${handle}; trying bounded fallback scan.`);
  }

  try {
    const fallback = await runInvestigation(handle, model, 90, 2, 17_000, "fallback");
    fallback.investigation.uncertainties = [
      "The standard-depth X investigation exceeded its latency budget, so VouchGuard used a narrower fallback scan.",
      ...fallback.investigation.uncertainties,
    ].slice(0, 8);
    fallback.investigation.confidence = Math.min(fallback.investigation.confidence, 0.68);
    if (fallback.investigation.coverage.sufficiency === "sufficient") {
      fallback.investigation.coverage.sufficiency = "limited";
      fallback.investigation.coverage.note = `${fallback.investigation.coverage.note} Result downgraded to limited because it came from the bounded fallback scan.`;
    }
    return { ...fallback, model };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The xAI investigation timed out at both standard and fallback depth. Try the scan again.");
    }
    throw error;
  }
}
