import { NextResponse } from "next/server";
import { INTEGRITY_METHODOLOGY_VERSION } from "@/lib/audit";
import { blobConfigured } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const demo = process.env.VOUCHGUARD_DEMO_MODE === "true";
  const xaiConfigured = Boolean(process.env.XAI_API_KEY);
  return NextResponse.json({
    ok: true,
    mode: demo ? "demo" : "live",
    model: process.env.XAI_MODEL || "grok-4.5-latest",
    xaiConfigured,
    primaryData: "commons-ledger",
    xApiRequired: false,
    storage: blobConfigured() ? "vercel-blob" : "stateless",
    methodologyVersion: INTEGRITY_METHODOLOGY_VERSION,
  });
}
