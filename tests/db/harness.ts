import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const ROOT = path.resolve(__dirname, "../..");

export type Db = PGlite;

/**
 * Boots an in-process Postgres that mimics what Supabase provides (roles, auth.uid(),
 * default table grants), then applies the project's REAL migrations and seed file.
 * This lets the RLS / booking-conflict tests exercise the actual SQL we deploy.
 */
export async function createDb(opts: { seed?: boolean } = {}): Promise<Db> {
  const db = new PGlite({ extensions: { btree_gist } });

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema auth to anon, authenticated, service_role;
    -- Supabase grants all table privileges to the API roles by default; RLS is the gate.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    -- Supabase ALSO grants EXECUTE on every new function to anon/authenticated/service_role (not just PUBLIC).
    -- Mirroring that here means a function missing an explicit REVOKE shows up as a failing test.
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);

  const dir = path.join(ROOT, "supabase/migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  if (opts.seed) {
    await db.exec(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  }
  return db;
}

type Row = Record<string, unknown>;

/** Run SQL as an authenticated user (or anon when userId is null). Always resets the role. */
export async function as<T extends Row = Row>(
  db: Db,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  try {
    const res = await db.query<T>(sql, params);
    return res.rows;
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Expect the statement to fail and return the Postgres error message. */
export async function failure(
  db: Db,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<string> {
  try {
    await as(db, userId, sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`Expected failure but statement succeeded: ${sql}`);
}

export async function createUser(
  db: Db,
  email: string,
  meta: Record<string, unknown> = {},
): Promise<string> {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
    [email, JSON.stringify(meta)],
  );
  return res.rows[0].id;
}

/** Admins can only be created by the database owner — exactly like production. */
export async function makeAdmin(db: Db, email: string): Promise<string> {
  const id = await createUser(db, email, { full_name: "Admin" });
  await db.query("update public.profiles set role = 'admin' where id = $1", [id]);
  return id;
}

export function dayOffset(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

export async function categoryId(db: Db, slug = "cottage"): Promise<number> {
  const r = await db.query<{ id: number }>("select id from public.property_categories where slug = $1", [slug]);
  return r.rows[0].id;
}

/** Inserts an approved, bookable property directly as the DB owner (bypassing review). */
export async function insertApprovedProperty(
  db: Db,
  hostId: string | null,
  overrides: Partial<{ slug: string; name: string; max_guests: number; price: number | null }> = {},
): Promise<string> {
  const slug = overrides.slug ?? `p-${Math.random().toString(36).slice(2, 10)}`;
  const res = await db.query<{ id: string }>(
    `insert into public.properties
       (host_id, slug, name, category_id, description, city, state, max_guests, price_inr, status, published_at)
     values ($1, $2, $3, $4, $5, 'Bengaluru', 'Karnataka', $6, $7, 'approved', now())
     returning id`,
    [
      hostId,
      slug,
      overrides.name ?? "Test Cottage",
      await categoryId(db),
      "A test property description that is comfortably longer than fifty characters.",
      overrides.max_guests ?? 4,
      overrides.price === undefined ? 5000 : overrides.price,
    ],
  );
  return res.rows[0].id;
}
