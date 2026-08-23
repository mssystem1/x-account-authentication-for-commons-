import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { auditCommonsCreator } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function requestKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(request: NextRequest) {
  const rate = rateLimit(requestKey(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many audits. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  try {
    const body = await request.json() as { handle?: unknown; refresh?: unknown };
    if (typeof body.handle !== "string") {
      return NextResponse.json({ error: "A valid X handle is required." }, { status: 400 });
    }

    const result = await auditCommonsCreator(body.handle, body.refresh === true);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commons integrity audit failed.";
    const isValidation = message.includes("valid X handle");
    const isNotFound = message.includes("not found in the Commons");
    const isRate = message.includes("rate limit");
    console.error("VouchGuard Commons audit error", error);
    return NextResponse.json(
      { error: message },
      { status: isValidation ? 400 : isNotFound ? 404 : isRate ? 429 : 502 },
    );
  }
}
