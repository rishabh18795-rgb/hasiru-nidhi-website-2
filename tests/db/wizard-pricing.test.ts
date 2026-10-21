import { beforeAll, describe, expect, it } from "vitest";
import { as, categoryId, createDb, createUser, failure, insertApprovedProperty, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;
let host: string;
let otherHost: string;
let guest: string;

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@example.test");
  host = await createUser(db, "host@example.test", { account_type: "host", full_name: "Host One" });
  otherHost = await createUser(db, "host2@example.test", { account_type: "host" });
  guest = await createUser(db, "guest@example.test", { full_name: "Guest One" });
});

/** The first Thursday at least 40 days out, as yyyy-mm-dd, plus n days. */
function thursdayPlus(n: number): string {
  const d = new Date(Date.now() + 40 * 86400000);
  while (d.getUTCDay() !== 4) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function priced(overrides: Record<string, unknown>): Promise<string> {
  const id = await insertApprovedProperty(db, host, { price: 5000 });
  const sets = Object.keys(overrides).map((k, i) => `${k} = $${i + 2}`).join(", ");
  if (sets) await db.query(`update public.properties set ${sets} where id = $1`, [id, ...Object.values(overrides)]);
  return id;
}
const quote = async (id: string, nights: number, guests: number, user: string | null = null) =>
  (await as<{ q: Record<string, number | string> | null }>(db, user, "select public.quote_stay($1, $2, $3, $4) as q", [id, thursdayPlus(0), thursdayPlus(nights), guests]))[0].q;

describe("structured pricing (quote_stay)", () => {
  it("charges the nightly rate for every night, with weekend nights (Fri/Sat) at the weekend rate", async () => {
    const id = await priced({ weekend_price_inr: 7000 });
    // Thu, Fri, Sat nights => 5000 + 7000 + 7000
    const q = await quote(id, 3, 2);
    expect(q).toMatchObject({ nights: 3, weekend_nights: 2, base: 19000, extra_guests: 0, cleaning: 0, tax: 0, total: 19000, currency: "INR" });
  });

  it("adds an extra-guest fee only above the included guests, per night", async () => {
    const id = await priced({ included_guests: 2, extra_guest_fee_inr: 500, max_guests: 6 });
    expect((await quote(id, 2, 2))!.extra_guests).toBe(0);
    expect((await quote(id, 2, 5))).toMatchObject({ extra_guests: 3 * 500 * 2, base: 10000, total: 13000 });
  });

  it("adds a one-off cleaning fee and tax on the subtotal, rounded to paise", async () => {
    const id = await priced({ cleaning_fee_inr: 999.5, tax_percent: 12 });
    // base 2 x 5000 = 10000 + 999.5 = 10999.5; tax 12% = 1319.94
    expect(await quote(id, 2, 2)).toMatchObject({ subtotal: 10999.5, tax: 1319.94, total: 12319.44 });
  });

  it("per-guest pricing multiplies by guests and nights", async () => {
    const id = await priced({ price_unit: "per_person_night", price_inr: 1500, max_guests: 8 });
    expect(await quote(id, 2, 3)).toMatchObject({ base: 9000, total: 9000, unit: "per_person_night" });
  });

  it("returns nothing when no price is configured (price on request)", async () => {
    const id = await priced({ price_inr: null });
    expect(await quote(id, 2, 2)).toBeNull();
  });

  it("quotes only live listings to the public; owners may quote their own drafts, others nothing", async () => {
    const id = await priced({ status: "draft", published_at: null });
    expect(await quote(id, 2, 2, null)).toBeNull();
    expect(await quote(id, 2, 2, guest)).toBeNull();
    expect(await quote(id, 2, 2, otherHost)).toBeNull();
    expect(await quote(id, 2, 2, host)).not.toBeNull();
    expect(await quote(id, 2, 2, admin)).not.toBeNull();
  });

  it("the compute function itself cannot be called from the API", async () => {
    expect(await failure(db, guest, "select public.compute_stay_quote(p, current_date, current_date + 1, 1) from public.properties p limit 1")).toMatch(/permission denied/);
  });

  it("rejects impossible pricing values", async () => {
    const id = await priced({});
    for (const sql of [
      "update public.properties set tax_percent = 55 where id = $1",
      "update public.properties set weekend_price_inr = -1 where id = $1",
      "update public.properties set min_nights = 5, max_nights = 3 where id = $1",
      "update public.properties set max_nights = 45 where id = $1",
      "update public.properties set currency = 'USD' where id = $1",
      "update public.properties set latitude = 120 where id = $1",
    ]) {
      expect(await failure(db, host, sql, [id]), sql).toMatch(/violates check constraint/);
    }
  });
});

describe("booking requests use the structured rules", () => {
  it("stores the quoted total and breakdown, and later price edits never rewrite it", async () => {
    const id = await priced({ weekend_price_inr: 6000, cleaning_fee_inr: 1000, tax_percent: 5 });
    const bookingId = (await as<{ b: string }>(db, guest, "select public.request_booking($1,$2,$3,2,0,null) as b", [id, thursdayPlus(0), thursdayPlus(3)]))[0].b;
    // 5000 + 6000 + 6000 = 17000 + 1000 = 18000; tax 900
    const [row] = await as<{ indicative_total_inr: string; price_breakdown: { total: number; weekend_nights: number } }>(db, guest, "select indicative_total_inr, price_breakdown from public.bookings where id = $1", [bookingId]);
    expect(Number(row.indicative_total_inr)).toBe(18900);
    expect(row.price_breakdown).toMatchObject({ total: 18900, weekend_nights: 2 });
    await db.query("update public.properties set price_inr = 99999 where id = $1", [id]);
    const [again] = await as<{ indicative_total_inr: string }>(db, guest, "select indicative_total_inr from public.bookings where id = $1", [bookingId]);
    expect(Number(again.indicative_total_inr)).toBe(18900);
  });

  it("enforces minimum and maximum stay on the server", async () => {
    const id = await priced({ min_nights: 2, max_nights: 4 });
    expect(await failure(db, guest, "select public.request_booking($1,$2,$3,2,0,null)", [id, thursdayPlus(0), thursdayPlus(1)])).toMatch(/invalid_stay_length:2-4/);
    expect(await failure(db, guest, "select public.request_booking($1,$2,$3,2,0,null)", [id, thursdayPlus(0), thursdayPlus(5)])).toMatch(/invalid_stay_length:2-4/);
    expect((await as(db, guest, "select public.request_booking($1,$2,$3,2,0,null)", [id, thursdayPlus(0), thursdayPlus(3)]))).toHaveLength(1);
  });

  it("a price-on-request listing can still be requested and has no total", async () => {
    const id = await priced({ price_inr: null });
    const b = (await as<{ b: string }>(db, guest, "select public.request_booking($1,$2,$3,2,0,null) as b", [id, thursdayPlus(10), thursdayPlus(12)]))[0].b;
    const [row] = await as<{ indicative_total_inr: string | null }>(db, guest, "select indicative_total_inr from public.bookings where id = $1", [b]);
    expect(row.indicative_total_inr).toBeNull();
  });
});

describe("listing wizard data and review outcomes", () => {
  async function submitted(slug: string): Promise<string> {
    const cat = await categoryId(db);
    const id = (await as<{ id: string }>(db, host,
      `insert into public.properties (host_id, slug, name, category_id, description, city, state, terms_accepted_at, photo_rights_confirmed_at)
       values ($1,$2,'Wizard Cottage',$3,$4,'Mysuru','Karnataka',now(),now()) returning id`,
      [host, slug, cat, "A lovely cottage with enough description text to satisfy the review rules."]))[0].id;
    await as(db, host, "insert into public.property_images (property_id, path, source) values ($1,'/images/x.jpg','static')", [id]);
    await as(db, host, "insert into public.property_private (property_id, address_line, contact_phone) values ($1,'1 Lane','+919000000001')", [id]);
    await as(db, host, "select public.submit_property($1)", [id]);
    return id;
  }

  it("will not submit without the photograph-rights declaration", async () => {
    const cat = await categoryId(db);
    const id = (await as<{ id: string }>(db, host,
      `insert into public.properties (host_id, slug, name, category_id, description, city, state, terms_accepted_at)
       values ($1,'no-rights',  'Wizard Cottage',$2,$3,'Mysuru','Karnataka',now()) returning id`,
      [host, cat, "A lovely cottage with enough description text to satisfy the review rules."]))[0].id;
    await as(db, host, "insert into public.property_images (property_id, path, source) values ($1,'/images/x.jpg','static')", [id]);
    await as(db, host, "insert into public.property_private (property_id, address_line, contact_phone) values ($1,'1 Lane','+919000000001')", [id]);
    expect(await failure(db, host, "select public.submit_property($1)", [id])).toMatch(/photo_rights/);
  });

  it("stores the wizard's location, room, pricing and exact-pin fields; the exact pin stays private", async () => {
    const id = await submitted("rich-1");
    await as(db, host, `update public.properties set country='India', bedrooms=3, beds=5, bathrooms=2.5,
      accommodation_arrangement='entire_property', location_precision='approximate', latitude=12.30, longitude=76.65 where id=$1`, [id]);
    await as(db, host, "update public.property_private set exact_latitude=12.295810, exact_longitude=76.639381 where property_id=$1", [id]);
    expect(await as(db, guest, "select * from public.property_private where property_id=$1", [id])).toHaveLength(0);
    expect(await as(db, otherHost, "select * from public.property_private where property_id=$1", [id])).toHaveLength(0);
    expect(await as(db, host, "select exact_latitude from public.property_private where property_id=$1", [id])).toHaveLength(1);
  });

  it("'request changes' returns the listing to the host with a reason, is audited, and resubmitting clears it", async () => {
    const id = await submitted("changes-1");
    expect(await failure(db, admin, "select public.review_property($1,'request_changes',null)", [id])).toMatch(/reason_required/);
    await as(db, admin, "select public.review_property($1,'request_changes','Please add a photo of the bedrooms')", [id]);
    const [p] = await as<{ status: string; review_kind: string; rejection_reason: string }>(db, host, "select status, review_kind, rejection_reason from public.properties where id=$1", [id]);
    expect(p).toEqual({ status: "rejected", review_kind: "changes_requested", rejection_reason: "Please add a photo of the bedrooms" });
    const note = await as<{ title: string }>(db, host, "select title from public.notifications where body like '%bedrooms%'");
    expect(note[0].title).toBe("Changes requested");
    expect((await as<{ action: string }>(db, admin, "select action from public.audit_logs where entity_id=$1 order by id desc limit 1", [id]))[0].action).toBe("property_request_changes");
    expect(await as(db, null, "select id from public.properties where id=$1", [id])).toHaveLength(0);

    await as(db, host, "select public.submit_property($1)", [id]);
    const [again] = await as<{ status: string; review_kind: string | null }>(db, host, "select status, review_kind from public.properties where id=$1", [id]);
    expect(again).toEqual({ status: "pending_review", review_kind: null });
  });

  it("a plain rejection records its kind, and hosts cannot forge review_kind", async () => {
    const id = await submitted("reject-1");
    await as(db, admin, "select public.review_property($1,'reject','Photos are not of the property')", [id]);
    expect((await as<{ review_kind: string }>(db, host, "select review_kind from public.properties where id=$1", [id]))[0].review_kind).toBe("rejected");
    expect(await failure(db, host, "update public.properties set review_kind = 'changes_requested' where id=$1", [id])).toMatch(/forbidden_property_change/);
  });

  it("hosts cannot create a draft that already carries a review outcome", async () => {
    const cat = await categoryId(db);
    expect(await failure(db, host,
      "insert into public.properties (host_id, slug, name, category_id, review_kind) values ($1,'forged',  'Forged Place',$2,'rejected')", [host, cat])).toMatch(/forbidden_property_change/);
  });
});

describe("become_host", () => {
  it("lets a traveller start hosting, once, with an audit entry", async () => {
    const t = await createUser(db, "future-host@example.test", { full_name: "Future Host" });
    await as(db, t, "select public.become_host()");
    expect((await as<{ role: string }>(db, t, "select role from public.profiles where id=$1", [t]))[0].role).toBe("host");
    await as(db, t, "select public.become_host()"); // idempotent
    expect((await as(db, admin, "select 1 from public.audit_logs where action='become_host' and entity_id=$1", [t]))).toHaveLength(1);
  });

  it("never creates or changes an administrator, and refuses anonymous and suspended callers", async () => {
    expect(await failure(db, admin, "select public.become_host()")).toMatch(/forbidden/);
    expect((await as<{ role: string }>(db, admin, "select role from public.profiles where id=$1", [admin]))[0].role).toBe("admin");
    expect(await failure(db, null, "select public.become_host()")).toMatch(/permission denied|not_authenticated/);
    const s = await createUser(db, "suspended@example.test");
    await db.query("update public.profiles set is_suspended = true where id=$1", [s]);
    expect(await failure(db, s, "select public.become_host()")).toMatch(/account_suspended/);
  });

  it("a traveller still cannot promote themselves by editing their profile", async () => {
    const t = await createUser(db, "sneaky@example.test");
    expect(await failure(db, t, "update public.profiles set role='host' where id=$1", [t])).toMatch(/forbidden|permission|not allowed/i);
  });
});

describe("property photographs", () => {
  it("caps a listing at 20 photographs", async () => {
    const id = await insertApprovedProperty(db, host);
    for (let i = 0; i < 20; i++) await as(db, host, "insert into public.property_images (property_id, path) values ($1,$2)", [id, `${id}/${i}.jpg`]);
    expect(await failure(db, host, "insert into public.property_images (property_id, path) values ($1,'x.jpg')", [id])).toMatch(/too_many_photos/);
  });

  it("owners can reorder (first = cover); other hosts and travellers cannot", async () => {
    const id = await insertApprovedProperty(db, host);
    const ids: string[] = [];
    for (const n of ["a", "b", "c"]) ids.push((await as<{ id: string }>(db, host, "insert into public.property_images (property_id, path) values ($1,$2) returning id", [id, `${id}/${n}.jpg`]))[0].id);
    await as(db, host, "select public.reorder_property_images($1, $2::uuid[])", [id, [ids[2], ids[0], ids[1]]]);
    const order = (await as<{ path: string }>(db, host, "select path from public.property_images where property_id=$1 order by sort_order", [id])).map((r) => r.path.split("/").pop());
    expect(order).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
    for (const user of [otherHost, guest, null]) {
      expect(await failure(db, user, "select public.reorder_property_images($1, $2::uuid[])", [id, ids])).toMatch(/forbidden|permission denied/);
    }
  });
});
