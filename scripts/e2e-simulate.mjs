import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.PORT || "3210";
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], { env: { ...process.env, VOUCHGUARD_DEMO_MODE: "true" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
child.stdout.on("data", (data) => { output += data.toString(); });
child.stderr.on("data", (data) => { output += data.toString(); });
async function waitForServer() { for (let attempt = 0; attempt < 40; attempt++) { try { const response = await fetch(`${base}/api/health`); if (response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 500)); } throw new Error(`Server did not start.\n${output}`); }
try {
  await waitForServer();
  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  if (health.mode !== "demo") throw new Error("Health endpoint is not in demo mode.");
  for (const handle of ["alice_builder", "yield_farmer", "bot_swarm_01"]) {
    const response = await fetch(`${base}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, refresh: true }) });
    if (!response.ok) throw new Error(`Scan failed for ${handle}: ${await response.text()}`);
    const result = await response.json();
    if (result.handle !== handle || typeof result.scores?.vouchConfidence !== "number") throw new Error(`Malformed scan result for ${handle}`);
    console.log(`${handle}: ${result.recommendation} · vouch confidence ${result.scores.vouchConfidence}`);
  }
  const home = await fetch(base).then((response) => response.text());
  if (!home.includes("Scan before")) throw new Error("Home page smoke check failed.");
  console.log("E2E simulation passed.");
} finally { child.kill("SIGTERM"); }
