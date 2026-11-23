import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

/** M6: product and service commission is UNCONFIGURED until the owner approves rates; the Stay rate is never reused; history is append-only. */
let db: Db;
let admin: string;
let user: string;
let plants: number;
let gardening: number;

const rpc = <T extends Record<string, unknown> = Record<string, unknown>>(who: string | null, sql: string, params: unknown[] = []) => as<T>(db, who, sql, params);
const rate = async (vertical: string, category: number | null) => (await db.query<{ r: string | null }>("select public.marketplace_commission_rate($1::public.commission_vertical, $2) as r", [vertical, category])).rows[0].r;
const set = (vertical: string, category: number | null, value: number | null, note = "Approved by the owner, 24 Nov 2026") =>
  rpc<{ id: number }>(admin, "select public.admin_set_marketplace_commission($1::public.commission_vertical, $2, $3, $4) as id", [vertical, category, value, note]);

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@test.dev");
  user = await createUser(db, "user@test.dev", { full_name: "User" });
  plants = (await db.query<{ id: number }>("select id from public.product_categories where slug = 'plants-seeds-saplings'")).rows[0].id;
  gardening = (await db.query<{ id: number }>("select id from public.service_categories where slug = 'gardening'")).rows[0].id;
});

describe("commission foundation", () => {
  it("is UNCONFIGURED by default and never falls back to the Stay rate", async () => {
    expect((await db.query("select count(*)::int as n from public.marketplace_commission_rates")).rows[0]).toEqual({ n: 0 });
    expect(await rate("products", null)).toBeNull();
    expect(await rate("services", gardening)).toBeNull();
    // a Stay rate exists in platform_settings; it must not leak into the marketplace
    await db.query("update public.platform_settings set value = '12'::jsonb where key = 'commission_rate_percent'");
    expect(await rate("products", null)).toBeNull();
    expect(await rate("services", null)).toBeNull();
  });

  it("only an administrator can set a rate, and it needs a note, a sane rate and a real category", async () => {
    expect(await failure(db, user, "select public.admin_set_marketplace_commission('products', null, 10, 'Approved')")).toMatch(/forbidden/);
    expect(await failure(db, null, "select public.admin_set_marketplace_commission('products', null, 10, 'Approved')")).toMatch(/permission denied/i);
    expect(await failure(db, admin, "select public.admin_set_marketplace_commission('products', null, 10, ' ')")).toMatch(/note_required/);
    expect(await failure(db, admin, "select public.admin_set_marketplace_commission('products', null, 51, 'Approved')")).toMatch(/invalid_rate/);
    expect(await failure(db, admin, "select public.admin_set_marketplace_commission('products', null, 10.555, 'Approved')")).toMatch(/invalid_rate/);
    expect(await failure(db, admin, "select public.admin_set_marketplace_commission('services', $1, 10, 'Approved')", [plants + 999])).toMatch(/invalid_category/);
  });

  it("uses the latest rate, lets a category override the vertical, and can be unconfigured again", async () => {
    await set("products", null, 8);
    expect(Number(await rate("products", plants))).toBe(8);
    await set("products", plants, 12.5);
    expect(Number(await rate("products", plants))).toBe(12.5);
    expect(Number(await rate("products", null))).toBe(8);
    await set("products", null, 9);
    expect(Number(await rate("products", null))).toBe(9);
    expect(await rate("services", null)).toBeNull();
    await set("products", plants, null, "Owner withdrew this rate");
    expect(Number(await rate("products", plants))).toBe(9); // falls back to the vertical-wide rate
  });

  it("keeps an append-only history and audits every change", async () => {
    await expect(db.query("update public.marketplace_commission_rates set rate_percent = 1")).rejects.toThrow(/append_only/);
    await expect(db.query("delete from public.marketplace_commission_rates")).rejects.toThrow(/append_only/);
    const n = (await db.query<{ n: number }>("select count(*)::int as n from public.marketplace_commission_rates")).rows[0].n;
    const audits = (await db.query<{ n: number }>("select count(*)::int as n from public.audit_logs where action = 'marketplace_commission_set'")).rows[0].n;
    expect(audits).toBe(n);
  });

  it("is readable only by an administrator and cannot be written directly", async () => {
    expect((await rpc(admin, "select * from public.marketplace_commission_rates")).length).toBeGreaterThan(0);
    expect(await rpc(user, "select * from public.marketplace_commission_rates")).toHaveLength(0);
    expect(await failure(db, admin, "insert into public.marketplace_commission_rates (vertical, rate_percent, note) values ('products', 5, 'direct')")).toMatch(/permission denied/i);
    expect(await failure(db, user, "select public.marketplace_commission_rate('products', null)")).toMatch(/permission denied/i);
  });
});
