import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, type Db } from "./harness";

const script = fs.readFileSync(path.resolve(__dirname, "../../supabase/scripts/create_first_admin.sql"), "utf8");
const forEmail = (email: string) => script.replace("REPLACE_WITH_YOUR_EMAIL@example.com", email);

let db: Db;
beforeAll(async () => { db = await createDb(); });

async function run(sql: string): Promise<string | null> {
  try { await db.exec(sql); return null; } catch (e) { return (e as Error).message; }
}

describe("first-administrator bootstrap script", () => {
  it("refuses to run until the e-mail has been edited", async () => {
    expect(await run(script)).toMatch(/Edit v_email first/);
  });

  it("refuses an account that does not exist or is not verified", async () => {
    expect(await run(forEmail("nobody@example.test"))).toMatch(/No VERIFIED account/);
    const id = await createUser(db, "unverified@example.test");
    expect(await run(forEmail("unverified@example.test"))).toMatch(/No VERIFIED account/);
    expect((await db.query<{ role: string }>("select role from public.profiles where id=$1", [id])).rows[0].role).not.toBe("admin");
  });

  it("promotes exactly the verified account, case-insensitively, and writes an audit entry", async () => {
    const id = await createUser(db, "owner@example.test");
    await createUser(db, "bystander@example.test");
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    expect(await run(forEmail("Owner@Example.test"))).toBeNull();
    const admins = (await db.query<{ email: string }>("select email from public.profiles where role = 'admin'")).rows;
    expect(admins.map((a) => a.email)).toEqual(["owner@example.test"]);
    const log = (await db.query<{ action: string; actor_id: string | null }>("select action, actor_id from public.audit_logs where entity_id=$1", [id])).rows;
    expect(log).toEqual([{ action: "bootstrap_admin", actor_id: null }]);
  });

  it("nobody can reproduce it through the API: not an anonymous caller, a host, nor the new admin on someone else", async () => {
    const host = await createUser(db, "host@example.test", { account_type: "host" });
    expect(await failure(db, host, "update public.profiles set role = 'admin' where id = $1", [host])).toMatch(/forbidden|not allowed|permission/i);
    // Anonymous: row-level security hides every row, so the statement changes nothing.
    expect(await as(db, null, "update public.profiles set role = 'admin' returning id")).toEqual([]);
    const other = await createUser(db, "other@example.test");
    const admin = (await db.query<{ id: string }>("select id from public.profiles where role = 'admin'")).rows[0].id;
    expect(await failure(db, admin, "select public.admin_update_user($1, 'admin')", [other])).toMatch(/admin_changes_not_allowed|invalid input|forbidden/i);
    expect(await as(db, admin, "select role from public.profiles where id = $1", [other])).toEqual([{ role: "traveller" }]);
    expect((await db.query("select 1 from public.profiles where role = 'admin'")).rows).toHaveLength(1);
  });
});
