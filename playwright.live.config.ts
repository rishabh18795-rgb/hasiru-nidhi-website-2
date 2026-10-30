import { defineConfig, devices } from "@playwright/test";

/**
 * Production smoke tests (read-only). They drive the DEPLOYED site in a real browser: they never create accounts, never submit a
 * booking and never write data. Usage:  npm run test:live   (BASE_URL defaults to the production site)
 */
export default defineConfig({
  testDir: "tests/live",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: { baseURL: process.env.BASE_URL ?? "https://hasiru-nidhi.vercel.app", trace: "retain-on-failure", channel: process.env.CI ? undefined : "chrome" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
});
