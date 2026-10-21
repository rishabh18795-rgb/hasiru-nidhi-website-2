import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Browser smoke tests against the PRODUCTION build, started with NO Supabase variables — i.e. the exact
 * "backend not configured" state a fresh deployment is in. They verify routing, redirects, validation,
 * headers and responsive layout. Flows that need a live database are covered by tests/db and by
 * docs/MANUAL_TESTING.md until a Supabase project exists.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Locally use the installed Chrome; CI installs Playwright's own Chromium.
    channel: process.env.CI ? undefined : "chrome",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
