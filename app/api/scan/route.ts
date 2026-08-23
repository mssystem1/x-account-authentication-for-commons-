import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { scanAccount } from "@/lib/scan";

export const runtime = "nodejs";
export const maxDuration = 60;

function requestKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(request: NextRequest) {
  const rate = rateLimit(requestKey(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many scans. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  try {
    const body = await request.json() as { handle?: unknown; refresh?: unknown };
    if (typeof body.handle !== "string") {
      return NextResponse.json({ error: "A valid X handle is required." }, { status: 400 });
    }

    const result = await scanAccount(body.handle, body.refresh === true);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account scan failed.";
    const isConfig = message.includes("XAI_API_KEY");
    const isValidation = message.includes("valid X handle");
    console.error("VouchGuard scan error", error);
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : isValidation ? 400 : 502 },
    );
  }
}
