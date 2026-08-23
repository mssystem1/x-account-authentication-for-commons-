import { NextResponse } from "next/server";
import { METHODOLOGY_VERSION } from "@/lib/scoring";
import { blobConfigured } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const demo = process.env.VOUCHGUARD_DEMO_MODE === "true";
  return NextResponse.json({
    ok: demo || Boolean(process.env.XAI_API_KEY),
    mode: demo ? "demo" : "live",
    model: process.env.XAI_MODEL || "grok-4.5-latest",
    xaiConfigured: Boolean(process.env.XAI_API_KEY),
    storage: blobConfigured() ? "vercel-blob" : "stateless",
    methodologyVersion: METHODOLOGY_VERSION,
  });
}
