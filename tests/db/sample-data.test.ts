import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, dayOffset, failure, insertApprovedProperty, type Db } from "./harness";

let db: Db;
let traveller: string;
let host: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  traveller = await createUser(db, "traveller@example.test", { full_name: "Test Traveller" });
  host = await createUser(db, "host@example.test", { account_type: "host" });
});

describe("sample listings for testing the marketplace", () => {
  it("are six, every one clearly labelled as sample in name, text and flag", async () => {
    const rows = await db.query<{ name: string; description: string; summary: string; is_sample: boolean; host_id: string | null }>(
      "select name, description, summary, is_sample, host_id from public.properties order by slug");
    expect(rows.rows).toHaveLength(6);
    for (const r of rows.rows) {
      expect(r.is_sample).toBe(true);
      expect(r.name).toMatch(/^Sample /);
      expect(`${r.summary} ${r.description}`.toLowerCase()).toContain("sample");
      expect(r.host_id).toBeNull(); // platform-managed: no invented host
    }
  });

  it("invent no reviews, bookings, ratings or hosts", async () => {
    for (const t of ["reviews", "bookings"]) expect((await db.query(`select 1 from public.${t}`)).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.profiles where role = 'host'")).rows.length).toBe(1); // only the test host created above
  });

  it("cover the categories and pricing rules a tester needs", async () => {
    const cats = (await db.query<{ slug: string }>("select distinct c.slug from public.properties p join public.property_categories c on c.id = p.category_id")).rows.map((r) => r.slug).sort();
    expect(cats).toEqual(["cottage", "cycling-friendly", "farm-stay", "nature-retreat", "villa", "village-homestay"]);
    const units = (await db.query<{ price_unit: string }>("select distinct price_unit from public.properties")).rows.map((r) => r.price_unit).sort();
    expect(units).toEqual(["per_night", "per_person_night"]);
    expect((await db.query("select 1 from public.properties where price_inr is null")).rows).toHaveLength(1); // price on request
  });

  it("every listing has at least one illustrative photograph with a label", async () => {
    const missing = await db.query("select p.slug from public.properties p where not exists (select 1 from public.property_images i where i.property_id = p.id)");
    expect(missing.rows).toEqual([]);
    const alts = (await db.query<{ alt: string }>("select alt from public.property_images")).rows;
    expect(alts.every((a) => /illustrative/i.test(a.alt))).toBe(true);
  });

  it("the villa exercises weekend rate, extra guests, cleaning, tax and minimum stay end to end", async () => {
    const id = (await db.query<{ id: string }>("select id from public.properties where slug = 'sample-hilltop-villa'")).rows[0].id;
    // Find the next Thursday so the 3 nights are Thu, Fri, Sat.
    const d = new Date(Date.now() + 60 * 86400000);
    while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1);
    const ci = d.toISOString().slice(0, 10);
    const co = new Date(d.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const [{ q }] = await as<{ q: Record<string, number> }>(db, null, "select public.quote_stay($1,$2,$3,8) as q", [id, ci, co]);
    // 14000 + 16500 + 16500 = 47000; 2 extra guests x 800 x 3 = 4800; cleaning 1500; subtotal 53300; tax 12% = 6396
    expect(q).toMatchObject({ nights: 3, weekend_nights: 2, base: 47000, extra_guests: 4800, cleaning: 1500, subtotal: 53300, tax: 6396, total: 59696 });
    expect(await failure(db, traveller, "select public.request_booking($1,$2,$3,2,0,null)", [id, ci, new Date(d.getTime() + 86400000).toISOString().slice(0, 10)])).toMatch(/invalid_stay_length:2-14/);
    expect((await as(db, traveller, "select public.request_booking($1,$2,$3,2,0,null)", [id, ci, co]))).toHaveLength(1);
  });

  it("the villa's sample block makes those nights unavailable to the public", async () => {
    const id = (await db.query<{ id: string }>("select id from public.properties where slug = 'sample-hilltop-villa'")).rows[0].id;
    const ranges = await as<{ start_date: string }>(db, null, "select * from public.property_unavailable_ranges($1)", [id]);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
    expect(await as(db, null, "select public.is_property_available($1,$2,$3) as ok", [id, dayOffset(21), dayOffset(23)])).toEqual([{ ok: false }]);
  });
});

describe("remove_sample_data.sql", () => {
  it("deletes every sample (with test bookings made on them) and nothing else", async () => {
    const real = await insertApprovedProperty(db, host, { slug: "real-one", name: "A Real Listing" });
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../../supabase/scripts/remove_sample_data.sql"), "utf8"));
    const left = (await db.query<{ slug: string; is_sample: boolean }>("select slug, is_sample from public.properties")).rows;
    expect(left).toEqual([{ slug: "real-one", is_sample: false }]);
    expect((await db.query("select 1 from public.bookings")).rows).toHaveLength(0);
    expect(real).toBeTruthy();
  });
});
