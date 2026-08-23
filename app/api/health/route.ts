import { NextResponse } from "next/server";
import { METHODOLOGY_VERSION } from "@/lib/scoring";
import { blobConfigured } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const demo = process.env.VOUCHGUARD_DEMO_MODE === "true";
  const xaiConfigured = Boolean(process.env.XAI_API_KEY);
  const xApiConfigured = Boolean(process.env.X_BEARER_TOKEN);
  return NextResponse.json({
    ok: demo || xaiConfigured,
    mode: demo ? "demo" : "live",
    model: process.env.XAI_MODEL || "grok-4.5-latest",
    xaiConfigured,
    xApiConfigured,
    retrieval: xApiConfigured ? "official-x-api" : "xai-x-search-fallback",
    storage: blobConfigured() ? "vercel-blob" : "stateless",
    methodologyVersion: METHODOLOGY_VERSION,
  });
}
