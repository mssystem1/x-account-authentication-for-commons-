import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3211",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- -p 3211",
    url: "http://127.0.0.1:3211/api/health",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VOUCHGUARD_DEMO_MODE: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
