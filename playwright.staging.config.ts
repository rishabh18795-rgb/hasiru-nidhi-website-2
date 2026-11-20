import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/** Browser tests against the real STAGING Supabase project, with the app built separately into .next-staging (see docs/STAGING.md). */
const env: Record<string, string> = {};
const file = path.join(__dirname, ".env.staging.local");
if (fs.existsSync(file)) for (const line of fs.readFileSync(file, "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }
const PORT = 3400;
// The app server never receives the service-role key: it does not need it (only the rate limiter and e-mail lookups use it), and it must not hold it.
delete env.SUPABASE_SERVICE_ROLE_KEY;

export default defineConfig({
  testDir: "tests/staging-e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "off", channel: "chrome" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { ...env, HN_DIST_DIR: ".next-staging" },
  },
});
