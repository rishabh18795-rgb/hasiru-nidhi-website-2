// Helpers for the STAGING verification scripts. Staging only: refuses to run against anything but the staging project.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const STAGING_REF = "wodgrgowxtfucjwbbwwk";
const PROD_REF = "lgeqyisotgtsnviwonia";

export function loadEnv() {
  const file = path.join(ROOT, ".env.staging.local");
  if (!fs.existsSync(file)) throw new Error(".env.staging.local is missing (see docs/STAGING.md)");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes(STAGING_REF) || env.NEXT_PUBLIC_SUPABASE_URL.includes(PROD_REF)) throw new Error("Refusing to run: the configured project is not the staging project.");
  return env;
}

export function savePassword(env) {
  if (env.STAGING_TEST_PASSWORD) return env.STAGING_TEST_PASSWORD;
  const pw = crypto.randomBytes(18).toString("base64url") + "Aa1!";
  fs.appendFileSync(path.join(ROOT, ".env.staging.local"), `STAGING_TEST_PASSWORD=${pw}\n`);
  env.STAGING_TEST_PASSWORD = pw;
  return pw;
}

export const clients = (env) => ({
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  anon: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }),
  service: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }),
});

/** Creates (or finds) a confirmed synthetic test user and returns a client signed in as them. */
export async function signedIn(env, c, email, name) {
  const password = savePassword(env);
  const { data: list } = await c.service.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await c.service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
  } else {
    await c.service.auth.admin.updateUserById(user.id, { password });
  }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return { id: user.id, email, client };
}

let passed = 0;
let failed = 0;
export async function check(label, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${label}\n       ${String(e.message ?? e).split("\n")[0]}`);
  }
}
export const summary = () => { console.log(`\n${passed} passed, ${failed} failed`); return failed === 0; };
export const must = (res, what = "call") => { if (res.error) throw new Error(`${what}: ${res.error.message}`); return res.data; };
export async function denied(promiseLike, pattern, what = "call") {
  const res = await promiseLike;
  if (!res.error) throw new Error(`${what}: expected an error matching ${pattern} but it succeeded`);
  if (pattern && !pattern.test(res.error.message)) throw new Error(`${what}: expected ${pattern}, got "${res.error.message}"`);
}
export const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
export const eq = (a, b, msg = "values differ") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
export const ROOT_DIR = ROOT;
