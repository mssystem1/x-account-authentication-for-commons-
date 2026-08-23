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

export async function investigateWithGrok(handle: string): Promise<{ investigation: GrokInvestigation; model: string; xSearchCalls: number }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured.");

  const model = process.env.XAI_MODEL || "grok-4.5-latest";
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: investigationPrompt(handle, isoDate(from), isoDate(to)),
        max_turns: 8,
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
      model,
      xSearchCalls: countXSearchCalls(payload),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The xAI investigation timed out. Try the scan again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
