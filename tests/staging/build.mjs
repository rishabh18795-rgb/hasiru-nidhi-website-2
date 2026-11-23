// Builds the app with STAGING public credentials into .next-staging, leaving the normal .next build alone. Staging only.
import { spawnSync } from "node:child_process";
import { loadEnv, ROOT_DIR } from "./lib.mjs";

const env = loadEnv();
// Only the public values are needed at build time; the service-role key is deliberately NOT passed.
const r = spawnSync("npx", ["next", "build"], { cwd: ROOT_DIR, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, HN_DIST_DIR: ".next-staging", HN_LOCAL_HTTP: "1" } });
process.exit(r.status ?? 1);
