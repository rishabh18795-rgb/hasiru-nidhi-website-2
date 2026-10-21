import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createDb } from "./harness";
import { buildBundle } from "../../scripts/bundle-sql.mjs";

describe("one-file database setup (supabase/setup-all.sql)", () => {
  it("is up to date with the migrations (run `npm run db:bundle` after adding one)", () => {
    const committed = fs.readFileSync(path.resolve(__dirname, "../../supabase/setup-all.sql"), "utf8");
    expect(committed).toBe(buildBundle());
  });

  it("installs cleanly on an empty database in a single run", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
    const db = new PGlite({ extensions: { btree_gist } });
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../../supabase/setup-all.sql"), "utf8"));
    const { rows } = await db.query<{ n: string }>("select count(*) n from public.property_categories");
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(11);
    await createDb(); // and the per-file path still works too
  });
});
