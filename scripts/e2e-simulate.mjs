import { spawn } from "node:child_process";
import process from "node:process";

const port = process.env.PORT || "3210";
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], {
  env: { ...process.env, VOUCHGUARD_DEMO_MODE: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (data) => { output += data.toString(); });
child.stderr.on("data", (data) => { output += data.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start.\n${output}`);
}

try {
  await waitForServer();
  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  if (health.mode !== "demo" || health.primaryData !== "commons-ledger") throw new Error("Health endpoint is not in Commons demo mode.");

  const handles = ["alice_builder", "organic_creator", "bot_swarm_01", "attacked_victim"];
  for (const handle of handles) {
    const response = await fetch(`${base}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, refresh: true }),
    });
    if (!response.ok) throw new Error(`Audit failed for ${handle}: ${await response.text()}`);
    const result = await response.json();
    if (result.handle !== handle || typeof result.metrics?.supportIntegrity !== "number" || typeof result.metrics?.slashAttackRisk !== "number") {
      throw new Error(`Malformed dual-axis result for ${handle}`);
    }
    if (!Array.isArray(result.supporters) || !Array.isArray(result.sourceEntries)) throw new Error(`Missing graph data for ${handle}`);
    if (handle === "attacked_victim" && result.report.verdict === "LIKELY_ORGANIC") throw new Error("Attack-victim regression: blanket organic verdict returned");
    console.log(`${handle}: ${result.report.verdict} · support ${result.metrics.supportIntegrity} · slash attack ${result.metrics.slashAttackRisk}`);
  }

  const home = await fetch(base).then((response) => response.text());
  if (!home.includes("Audit the")) throw new Error("Home page smoke check failed.");
  console.log("E2E dual-axis Commons rank audit simulation passed.");
} finally {
  child.kill("SIGTERM");
}
