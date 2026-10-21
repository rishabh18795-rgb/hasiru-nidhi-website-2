import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Db } from "./harness";

/**
 * The app talks to Supabase with string-typed table/column/RPC names that TypeScript cannot check.
 * Without a live Supabase project in CI, this contract test statically extracts every one the code
 * uses and verifies it against the REAL migrated schema, so a typo or a renamed column fails here
 * instead of at runtime.
 */
const SRC = path.resolve(__dirname, "../../src");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

let db: Db;
const columns = new Map<string, Set<string>>();
const functions = new Map<string, string[]>();

beforeAll(async () => {
  db = await createDb();
  const cols = await db.query<{ table_name: string; column_name: string }>(
    "select table_name, column_name from information_schema.columns where table_schema = 'public'",
  );
  for (const c of cols.rows) {
    if (!columns.has(c.table_name)) columns.set(c.table_name, new Set());
    columns.get(c.table_name)!.add(c.column_name);
  }
  const fns = await db.query<{ proname: string; proargnames: string[] | null }>(
    "select p.proname, p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
  );
  for (const f of fns.rows) functions.set(f.proname, f.proargnames ?? []);
});

const files = walk(SRC).filter((f) => !f.includes("/lib/db/types"));
const sources = files.map((f) => ({ file: path.relative(SRC, f), text: fs.readFileSync(f, "utf8") }));

interface Chain { file: string; table: string; text: string }

/** Every `.from("table") ... ;` statement, as written in the source. */
function chains(): Chain[] {
  const out: Chain[] = [];
  for (const { file, text } of sources) {
    for (const m of text.matchAll(/\.from\("([a-z_]+)"\)/g)) {
      const start = m.index!;
      const rest = text.slice(start);
      // The chain ends at a `;`, at a top-level `,` (next array element, e.g. inside Promise.all),
      // or when its enclosing bracket closes (depth < 0).
      let depth = 0, end = rest.length;
      for (let i = 0; i < rest.length; i++) {
        const ch = rest[i];
        if ("({[".includes(ch)) depth++;
        else if (")}]".includes(ch)) { depth--; if (depth < 0) { end = i; break; } }
        else if ((ch === ";" || ch === ",") && depth === 0) { end = i; break; }
      }
      out.push({ file, table: m[1], text: rest.slice(0, end) });
    }
  }
  return out;
}

/** Top-level comma-separated tokens of a PostgREST select string (embeds are skipped). */
function plainSelectColumns(select: string): string[] {
  const tokens: string[] = [];
  let depth = 0, cur = "";
  for (const ch of select) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; } else cur += ch;
  }
  tokens.push(cur.trim());
  return tokens.filter((t) => t && t !== "*" && !/[(!:]/.test(t));
}

/** Keys of the first object literal passed to insert/update/upsert (depth-1 `key:` and shorthand). */
function writeKeys(text: string): string[] {
  const m = text.match(/\.(insert|update|upsert)\(\s*(\{)/);
  if (!m) return [];
  let i = text.indexOf("{", m.index!);
  let depth = 0, cur = "";
  const segs: string[] = [];
  for (; i < text.length; i++) {
    const ch = text[i];
    if ("({[".includes(ch)) { depth++; if (depth === 1) continue; }
    if (")}]".includes(ch)) { depth--; if (depth === 0) { segs.push(cur); break; } }
    if (ch === "," && depth === 1) { segs.push(cur); cur = ""; continue; }
    cur += ch;
  }
  const keys: string[] = [];
  for (const seg of segs) {
    const s = seg.trim();
    if (!s || s.startsWith("...")) continue;
    const key = s.match(/^([a-z_]+)\s*(:|$)/i);
    if (key) keys.push(key[1]);
  }
  return keys;
}

describe("app ↔ schema contract", () => {
  const all = chains();

  it("finds the app's database calls (sanity check on the extractor)", () => {
    expect(all.length).toBeGreaterThan(40);
    expect(new Set(all.map((c) => c.table)).size).toBeGreaterThan(12);
  });

  it("every table/view the app queries exists", () => {
    const missing = [...new Set(all.map((c) => c.table))].filter((t) => !columns.has(t));
    expect(missing).toEqual([]);
  });

  it("every plain column in .select(), filters, .order() and writes exists on its table", () => {
    const problems: string[] = [];
    for (const c of all) {
      const known = columns.get(c.table);
      if (!known) continue;
      const wanted = new Set<string>();
      for (const m of c.text.matchAll(/\.select\(\s*"([^"]+)"/g)) plainSelectColumns(m[1]).forEach((x) => wanted.add(x));
      for (const m of c.text.matchAll(/\.(eq|neq|gte|lte|gt|lt|not|in|order|is)\(\s*"([a-z_]+)"/g)) wanted.add(m[2]);
      for (const k of writeKeys(c.text)) wanted.add(k);
      for (const col of wanted) if (!known.has(col)) problems.push(`${c.file}: ${c.table}.${col}`);
    }
    expect(problems).toEqual([]);
  });

  it("every RPC the app calls exists and every named parameter is real", () => {
    const problems: string[] = [];
    let seen = 0;
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/\.rpc\(\s*"([a-z_]+)"\s*(?:,\s*\{([^}]*)\})?/g)) {
        seen++;
        const [, name, args = ""] = m;
        const params = functions.get(name);
        if (!params) { problems.push(`${file}: rpc ${name} does not exist`); continue; }
        for (const k of args.matchAll(/\b(p_[a-z_]+)\s*:/g)) {
          if (!params.includes(k[1])) problems.push(`${file}: rpc ${name} has no parameter ${k[1]}`);
        }
      }
    }
    expect(seen).toBeGreaterThanOrEqual(8);
    expect(problems).toEqual([]);
  });

  it("table names used in embedded selects exist too (e.g. properties(slug))", () => {
    const missing: string[] = [];
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/\.select\(\s*"([^"]+)"/g)) {
        for (const e of m[1].matchAll(/\b([a-z_]+)\(/g)) {
          if (["count"].includes(e[1])) continue;
          if (!columns.has(e[1])) missing.push(`${file}: embeds ${e[1]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("the Postgres error codes the UI translates are really raised by the database", () => {
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const sql = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    const actionSrc = fs.readFileSync(path.join(SRC, "lib/action.ts"), "utf8");
    for (const code of ["dates_unavailable", "duplicate_request", "invalid_dates", "invalid_guests", "property_unavailable", "own_property", "invalid_status", "reason_required", "blocks_confirmed_booking", "stay_already_started", "account_suspended", "not_authenticated", "incomplete_listing", "invalid_stay_length", "too_many_photos"]) {
      expect(sql, `${code} raised by SQL`).toContain(code);
      expect(actionSrc, `${code} translated by UI`).toContain(code);
    }
  });
});
