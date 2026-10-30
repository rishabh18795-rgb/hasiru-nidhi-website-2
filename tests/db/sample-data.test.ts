import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, dayOffset, failure, insertApprovedProperty, type Db } from "./harness";
import { buildSeed } from "../../scripts/gen-seed.mjs";

const ROOT = path.resolve(__dirname, "../..");
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/demo-properties.json"), "utf8")).properties as { slug: string; name: string }[];
const NAMES = ["Green Valley Farm Stay", "Countryside Garden Cottage", "Forest Edge Eco Retreat", "Riverside Nature Escape", "Organic Farm Experience", "Weekend Cycling Retreat"];

let db: Db;
let traveller: string;
let host: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  traveller = await createUser(db, "traveller@example.test", { full_name: "Test Traveller" });
  host = await createUser(db, "host@example.test", { account_type: "host" });
});

describe("the demo dataset and seed", () => {
  it("seed.sql is generated from demo-properties.json and up to date (run `npm run db:seed`)", () => {
    expect(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8")).toBe(buildSeed());
  });

  it("has exactly the six requested listings", () => {
    expect(demo.map((d) => d.name)).toEqual(NAMES);
  });

  it("seeding twice is harmless (repeatable)", async () => {
    const before = (await db.query("select 1 from public.properties")).rows.length;
    await db.exec(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
    expect((await db.query("select 1 from public.properties")).rows).toHaveLength(before);
    expect((await db.query("select 1 from public.property_images")).rows.length).toBe(demo.length * 2);
  });
});

describe("demo listings are isolated from real inventory", () => {
  it("are six, every one flagged as sample, labelled in the text, and owner-less", async () => {
    const rows = await db.query<{ name: string; description: string; summary: string; is_sample: boolean; host_id: string | null }>(
      "select name, description, summary, is_sample, host_id from public.properties order by slug");
    expect(rows.rows).toHaveLength(6);
    expect(rows.rows.map((r) => r.name).sort()).toEqual([...NAMES].sort());
    for (const r of rows.rows) {
      expect(r.is_sample).toBe(true);
      expect(r.description).toMatch(/DEMONSTRATION LISTING — SAMPLE DATA/);
      expect(r.summary).toMatch(/^Demo listing:/);
      expect(r.host_id).toBeNull();
    }
  });

  it("invent no reviews, bookings, ratings, owners or payment records", async () => {
    for (const t of ["reviews", "bookings"]) expect((await db.query(`select 1 from public.${t}`)).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.profiles where role = 'host'")).rows.length).toBe(1); // only the test host created above
  });

  it("cover the property types, price models and rules a tester needs", async () => {
    const cats = (await db.query<{ slug: string }>("select distinct c.slug from public.properties p join public.property_categories c on c.id = p.category_id")).rows.map((r) => r.slug).sort();
    expect(cats).toEqual(["cottage", "cycling-friendly", "eco-retreat", "farm-stay", "nature-retreat"]);
    expect((await db.query<{ price_unit: string }>("select distinct price_unit from public.properties")).rows.map((r) => r.price_unit).sort()).toEqual(["per_night", "per_person_night"]);
    for (const col of ["bedrooms", "beds", "bathrooms", "price_inr", "house_rules"]) {
      expect((await db.query(`select 1 from public.properties where ${col} is null or ${col}::text = ''`)).rows, col).toHaveLength(0);
    }
  });

  it("each has two illustrative photographs, several facilities and experiences, and check-in/out times", async () => {
    for (const d of demo) {
      const id = (await db.query<{ id: string }>("select id from public.properties where slug = $1", [d.slug])).rows[0].id;
      const n = async (table: string) => (await db.query(`select 1 from public.${table} where property_id = $1`, [id])).rows.length;
      expect(await n("property_images"), d.slug).toBe(2);
      expect(await n("property_amenities"), d.slug).toBeGreaterThanOrEqual(5);
      expect(await n("property_experiences"), d.slug).toBeGreaterThanOrEqual(2);
    }
    const alts = (await db.query<{ alt: string }>("select alt from public.property_images")).rows;
    expect(alts.every((a) => /illustrative/i.test(a.alt))).toBe(true);
  });

  it("the search cards carry bedrooms, bathrooms and amenity names", async () => {
    const rows = await as<{ slug: string; bedrooms: number; bathrooms: string; amenity_names: string[] }>(db, null, "select slug, bedrooms, bathrooms, amenity_names from public.search_properties()");
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.bedrooms).toBeGreaterThan(0);
      expect(Number(r.bathrooms)).toBeGreaterThan(0);
      expect(r.amenity_names.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("pricing rules exercise weekend rates, extra guests, cleaning and minimum stays end to end", async () => {
    const d = new Date(Date.now() + 60 * 86400000);
    while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1); // a Thursday: Thu, Fri, Sat nights
    const ci = d.toISOString().slice(0, 10);
    const co = new Date(d.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const id = async (slug: string) => (await db.query<{ id: string }>("select id from public.properties where slug = $1", [slug])).rows[0].id;
    const quote = async (slug: string, guests: number) => (await as<{ q: Record<string, number> }>(db, null, "select public.quote_stay($1,$2,$3,$4) as q", [await id(slug), ci, co, guests]))[0].q;
    // Weekend Cycling Retreat: 9000 + 11000 + 11000 = 31000; 8 guests = 2 extra x 700 x 3 = 4200
    expect(await quote("demo-weekend-cycling-retreat", 8)).toMatchObject({ base: 31000, weekend_nights: 2, extra_guests: 4200, total: 35200 });
    // Forest Edge: 3 x 7500 + 800 cleaning
    expect(await quote("demo-forest-edge-eco-retreat", 2)).toMatchObject({ base: 22500, cleaning: 800, total: 23300 });
    // Organic Farm is per guest: 1600 x 3 guests x 3 nights
    expect(await quote("demo-organic-farm-experience", 3)).toMatchObject({ base: 14400, total: 14400 });
    // Minimum stay on the riverside listing is 2 nights
    expect(await failure(db, traveller, "select public.request_booking($1,$2,$3,2,0,null)", [await id("demo-riverside-nature-escape"), ci, new Date(d.getTime() + 86400000).toISOString().slice(0, 10)])).toMatch(/invalid_stay_length:2-10/);
  });

  it("the demo blocks make those nights unavailable to the public", async () => {
    const id = (await db.query<{ id: string }>("select id from public.properties where slug = 'demo-green-valley-farm-stay'")).rows[0].id;
    expect(await as(db, null, "select public.is_property_available($1,$2,$3) as ok", [id, dayOffset(13), dayOffset(14)])).toEqual([{ ok: false }]);
    expect(await as(db, null, "select public.is_property_available($1,$2,$3) as ok", [id, dayOffset(40), dayOffset(42)])).toEqual([{ ok: true }]);
  });
});

describe("remove_sample_data.sql", () => {
  it("deletes every demo listing (with test bookings made on them) and nothing else", async () => {
    await insertApprovedProperty(db, host, { slug: "real-one", name: "A Real Listing" });
    await db.exec(fs.readFileSync(path.join(ROOT, "supabase/scripts/remove_sample_data.sql"), "utf8"));
    expect((await db.query<{ slug: string; is_sample: boolean }>("select slug, is_sample from public.properties")).rows).toEqual([{ slug: "real-one", is_sample: false }]);
    expect((await db.query("select 1 from public.bookings")).rows).toHaveLength(0);
  });
});
