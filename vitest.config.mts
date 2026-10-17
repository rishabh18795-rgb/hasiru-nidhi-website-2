import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each DB test file boots its own WASM Postgres; give it room on slower machines.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
