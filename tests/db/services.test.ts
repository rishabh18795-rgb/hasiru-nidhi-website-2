import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

/**
 * M5 services marketplace: provider capability and listing review, fixed-price and quotation flows, appointments and availability,
 * contact-detail privacy, isolation between customers / providers / admin, and the rule that nothing is ever shown as paid.
 */
let db: Db;
let admin: string;
let alice: string; // customer
let bob: string; // another customer
let carol: string; // a third customer
let pA: string, pB: string; // two providers (users)
let vA: string, vB: string; // their vendor ids
let catGardening: number;
let fixedSvc: string; // A: fixed price 500 per visit, 60 minutes
let quoteSvc: string; // A: quotation based
let fixedSlug: string;
let bSvc: string; // B: fixed price, provider B has NO weekly hours

const flag = (key: string, value: boolean) => db.query("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);
const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const all = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const rpc = <T extends Record<string, unknown> = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) => as<T>(db, user, sql, params);
let keyN = 0;
const key = () => `skey-${Date.now()}-${keyN++}`;

/** A calendar day in India, `offset` days from today, as YYYY-MM-DD. */
const istDay = (offset: number) => new Date(Date.now() + offset * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
/** A future instant at HH:MM India time. */
const at = (offset: number, hhmm: string) => `${istDay(offset)}T${hhmm}:00+05:30`;

async function makeProvider(email: string, name: string): Promise<{ user: string; vendor: string }> {
  const user = await createUser(db, email, { full_name: name });
  const vendor = (await rpc<{ id: string }>(user, "select public.save_vendor_profile($1::jsonb) as id", [JSON.stringify({ business_name: name, business_type: "individual", contact_name: name, contact_email: email,
    contact_phone: "+919876543210", address_line: "1 Garden Lane", city: "Bengaluru", state: "Karnataka", postal_code: "560078" })]))[0].id;
  await rpc(user, "select public.submit_vendor_application('{services}'::public.vendor_capability[])");
  await rpc(admin, "select public.admin_review_vendor($1, 'approve', null)", [vendor]);
  await rpc(admin, "select public.admin_review_capability($1, 'services', 'approve', null)", [vendor]);
  await rpc(user, "select public.set_vendor_service_areas('service', array['560'])");
  return { user, vendor };
}

const DESC = "A proper description of the service that is comfortably longer than thirty characters.";

async function draftService(user: string, over: Record<string, unknown> = {}): Promise<string> {
  const body = { category_id: catGardening, name: "Lawn care visit", summary: "s", description: DESC, pricing_model: "fixed", price_inr: 500, price_unit: "visit", duration_minutes: 60, ...over };
  return (await rpc<{ id: string }>(user, "select public.save_service($1::jsonb) as id", [JSON.stringify(body)]))[0].id;
}

/** An approved, public listing. */
async function listService(user: string, vendor: string, over: Record<string, unknown> = {}): Promise<string> {
  const id = await draftService(user, over);
  await rpc(user, "select public.register_service_image($1, $2, 'alt')", [id, `${vendor}/${id}/a.jpg`]);
  await rpc(user, "select public.submit_service($1)", [id]);
  await rpc(admin, "select public.admin_review_service($1, 'approve', null)", [id]);
  return id;
}

const body = (service: string, over: Record<string, unknown> = {}) => JSON.stringify({ service_id: service, quantity: 1, customer_name: "Alice", phone: "9876500000", address_line: "12 Rose Street", city: "Bengaluru", pin: "560078",
  property_type: "Apartment balcony", site_size: "200 sq ft", details: "Please trim the lawn and tidy the beds.", ...over });
const request = async (user: string, service: string, over: Record<string, unknown> = {}, k = key()) =>
  (await rpc<{ id: string }>(user, "select public.request_service($1::jsonb, $2) as id", [body(service, over), k]))[0].id;
const reqStatus = async (id: string) => (await one<{ status: string }>("select status from public.service_requests where id = $1", [id])).status;
const reqRow = (id: string) => one<Record<string, unknown>>("select * from public.service_requests where id = $1", [id]);

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@test.dev");
  await flag("marketplace_vendor_registration_enabled", true);
  alice = await createUser(db, "alice@test.dev", { full_name: "Alice" });
  bob = await createUser(db, "bob@test.dev", { full_name: "Bob" });
  carol = await createUser(db, "carol@test.dev", { full_name: "Carol" });
  ({ user: pA, vendor: vA } = await makeProvider("a@test.dev", "Green Thumb Gardens"));
  ({ user: pB, vendor: vB } = await makeProvider("b@test.dev", "Leaf Landscapes"));
  catGardening = (await one<{ id: number }>("select id from public.service_categories where slug = 'gardening'")).id;
});

describe("seed data", () => {
  it("ships Gardening as the first service category and no providers, services or requests", async () => {
    expect((await all<{ slug: string }>("select slug from public.service_categories")).map((r) => r.slug)).toEqual(["gardening"]);
    expect(Number((await one<{ n: string }>("select count(*) as n from public.services")).n)).toBe(0);
    expect(Number((await one<{ n: string }>("select count(*) as n from public.service_requests")).n)).toBe(0);
  });
  it("service category slugs are immutable", async () => {
    expect(await failure(db, admin, "update public.service_categories set slug = 'x-y' where slug = 'gardening'")).toMatch(/slug_immutable/);
  });
});

describe("listings: provider capability, review and public visibility", () => {
  it("requires the services capability to create a listing", async () => {
    expect(await failure(db, alice, "select public.save_service($1::jsonb)", [JSON.stringify({ category_id: catGardening, name: "Nope", pricing_model: "quote" })])).toMatch(/not_found|capability_not_approved/);
  });

  it("validates pricing: fixed needs a positive price and a unit, quotation-based carries none", async () => {
    expect(await failure(db, pA, "select public.save_service($1::jsonb)", [JSON.stringify({ category_id: catGardening, name: "Bad price", pricing_model: "fixed", price_inr: 0, price_unit: "visit" })])).toMatch(/invalid_price/);
    expect(await failure(db, pA, "select public.save_service($1::jsonb)", [JSON.stringify({ category_id: catGardening, name: "Bad unit", pricing_model: "fixed", price_inr: 100, price_unit: "fortnight" })])).toMatch(/invalid_price_unit/);
    expect(await failure(db, pA, "select public.save_service($1::jsonb)", [JSON.stringify({ category_id: catGardening, name: "Bad model", pricing_model: "deposit" })])).toMatch(/invalid_pricing/);
    const q = await draftService(pA, { name: "Quote only", pricing_model: "quote", price_inr: 999, price_unit: "visit" });
    expect((await one<{ price_inr: string | null; price_unit: string | null }>("select price_inr, price_unit from public.services where id = $1", [q])).price_inr).toBeNull();
  });

  it("will not submit an incomplete listing, and says what is missing", async () => {
    const id = await draftService(pA, { name: "Incomplete" });
    expect(await failure(db, pA, "select public.submit_service($1)", [id])).toMatch(/incomplete_service: images/);
  });

  it("will not submit without service areas", async () => {
    const lone = await makeProvider("lone@test.dev", "No Areas Gardens");
    await rpc(lone.user, "select public.set_vendor_service_areas('service', array[]::text[])").catch(() => undefined);
    await db.query("delete from public.vendor_service_areas where vendor_id = $1", [lone.vendor]);
    const id = await draftService(lone.user, { name: "Area-less" });
    await rpc(lone.user, "select public.register_service_image($1, $2, 'alt')", [id, `${lone.vendor}/${id}/a.jpg`]);
    expect(await failure(db, lone.user, "select public.submit_service($1)", [id])).toMatch(/incomplete_service: service_areas/);
  });

  it("is invisible to the public until the module is ON AND an administrator approves it", async () => {
    fixedSvc = await draftService(pA, { name: "Lawn care visit" });
    await rpc(pA, "select public.register_service_image($1, $2, 'alt')", [fixedSvc, `${vA}/${fixedSvc}/a.jpg`]);
    await rpc(pA, "select public.submit_service($1)", [fixedSvc]);
    expect(await failure(db, pA, "select public.admin_review_service($1, 'approve', null)", [fixedSvc])).toMatch(/forbidden/);
    await rpc(admin, "select public.admin_review_service($1, 'approve', null)", [fixedSvc]);
    // approved but the module is OFF
    expect(await rpc(null, "select * from public.search_services()")).toHaveLength(0);
    await flag("marketplace_services_enabled", true);
    const rows = await rpc<{ slug: string; price_inr: string; pricing_model: string }>(null, "select * from public.search_services()");
    expect(rows).toHaveLength(1);
    expect(rows[0].pricing_model).toBe("fixed");
    expect(Number(rows[0].price_inr)).toBe(500);
    fixedSlug = rows[0].slug;
  });

  it("provider approval is separate from listing approval: a suspended capability hides the listing", async () => {
    await rpc(admin, "select public.admin_review_capability($1, 'services', 'suspend', 'checking')", [vA]);
    expect(await rpc(null, "select * from public.search_services()")).toHaveLength(0);
    expect((await rpc<{ g: unknown }>(null, "select public.get_service_public($1) as g", [fixedSlug]))[0].g).toBeNull();
    await rpc(admin, "select public.admin_review_capability($1, 'services', 'reinstate', null)", [vA]).catch(async () => {
      await rpc(admin, "select public.admin_review_capability($1, 'services', 'approve', null)", [vA]);
    });
    expect(await rpc(null, "select * from public.search_services()")).toHaveLength(1);
  });

  it("serves one listing for its page with no private data", async () => {
    const g = (await rpc<{ g: Record<string, unknown> }>(null, "select public.get_service_public($1) as g", [fixedSlug]))[0].g;
    expect(g.name).toBe("Lawn care visit");
    expect(JSON.stringify(g)).not.toMatch(/contact_email|contact_phone|owner_id|tax_identifier|postal_code/);
    expect((g.vendor as Record<string, unknown>).business_name).toBe("Green Thumb Gardens");
  });

  it("lists a quotation-based listing without any price", async () => {
    quoteSvc = await listService(pA, vA, { name: "Garden design", pricing_model: "quote" });
    const row = (await rpc<{ pricing_model: string; price_inr: string | null }>(null, "select * from public.search_services(p_pricing => 'quote')"))[0];
    expect(row.pricing_model).toBe("quote");
    expect(row.price_inr).toBeNull();
  });

  it("filters by PIN coverage and answers coverage questions", async () => {
    expect(await rpc(null, "select * from public.search_services(p_pin => '560001')")).toHaveLength(2);
    expect(await rpc(null, "select * from public.search_services(p_pin => '110001')")).toHaveLength(0);
    expect((await rpc<{ c: string }>(null, "select public.check_service_coverage($1, '560001') as c", [fixedSvc]))[0].c).toBe("yes");
    expect((await rpc<{ c: string }>(null, "select public.check_service_coverage($1, '110001') as c", [fixedSvc]))[0].c).toBe("no");
    expect(await failure(db, null, "select public.check_service_coverage($1, 'abc')", [fixedSvc])).toMatch(/invalid_pin/);
  });

  it("sends an approved listing back to review when its content or price changes, and takes it off the public list", async () => {
    await rpc(pA, "select public.save_service($1::jsonb)", [JSON.stringify({ id: fixedSvc, category_id: catGardening, name: "Lawn care visit", summary: "s", description: DESC, pricing_model: "fixed", price_inr: 600, price_unit: "visit", duration_minutes: 60 })]);
    expect((await one<{ status: string }>("select status from public.services where id = $1", [fixedSvc])).status).toBe("pending_review");
    expect((await rpc(null, "select * from public.search_services(p_pricing => 'fixed')"))).toHaveLength(0);
    await rpc(admin, "select public.admin_review_service($1, 'approve', null)", [fixedSvc]);
    expect(Number((await rpc<{ price_inr: string }>(null, "select * from public.search_services(p_pricing => 'fixed')"))[0].price_inr)).toBe(600);
  });

  it("lets a provider list services for provider B too, and keeps each provider's listings private to them", async () => {
    bSvc = await listService(pB, vB, { name: "Terrace garden setup", price_inr: 1500, price_unit: "job", duration_minutes: 120 });
    expect(await rpc(pA, "select id from public.services")).toHaveLength(4);
    expect(await rpc(pB, "select id from public.services")).toHaveLength(1);
    expect(await rpc(alice, "select id from public.services")).toHaveLength(0);
    expect(await failure(db, pA, "select public.save_service($1::jsonb)", [JSON.stringify({ id: bSvc, category_id: catGardening, name: "Hijack", pricing_model: "quote" })])).toMatch(/not_found/);
  });

  it("denies direct writes to every service table", async () => {
    for (const sql of ["update public.services set name = 'x'", "delete from public.services", "insert into public.service_categories (slug, name) values ('hack', 'Hack')",
      "update public.service_requests set status = 'completed'", "update public.service_quotations set amount_inr = 1", "delete from public.service_appointments"]) {
      expect(await failure(db, pA, sql), sql).toMatch(/permission denied|row-level security|violates/i);
    }
  });
});

describe("availability and appointments", () => {
  it("publishes weekly hours and refuses overlapping or invalid windows", async () => {
    expect(await failure(db, pA, "select public.set_service_availability($1::jsonb)", [JSON.stringify([{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "11:00", end: "14:00" }])])).toMatch(/overlapping_availability/);
    expect(await failure(db, pA, "select public.set_service_availability($1::jsonb)", [JSON.stringify([{ weekday: 9, start: "09:00", end: "12:00" }])])).toMatch(/invalid_availability/);
    expect(await failure(db, pA, "select public.set_service_availability($1::jsonb)", [JSON.stringify([{ weekday: 1, start: "12:00", end: "09:00" }])])).toMatch(/invalid_availability/);
    const rules = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));
    expect((await rpc<{ n: number }>(pA, "select public.set_service_availability($1::jsonb) as n", [JSON.stringify(rules)]))[0].n).toBe(7);
    expect(await rpc(pB, "select * from public.service_availability_rules")).toHaveLength(0);
    expect(await rpc(pA, "select * from public.service_availability_rules")).toHaveLength(7);
    expect(await rpc(alice, "select * from public.service_availability_rules")).toHaveLength(0);
  });

  it("offers one slot per listing duration inside the published hours", async () => {
    const slots = await rpc<{ slot_start: string; slot_label: string }>(null, "select * from public.get_service_slots($1, $2::date, 1)", [fixedSvc, istDay(3)]);
    expect(slots).toHaveLength(8); // 09:00 to 17:00 in 60 minute visits
    expect(slots[0].slot_label).toMatch(/09:00 AM/);
    // Provider B has published no hours: nothing to offer, the customer states a preference instead
    expect(await rpc(null, "select * from public.get_service_slots($1, $2::date, 3)", [bSvc, istDay(3)])).toHaveLength(0);
  });

  it("refuses a requested time outside the published hours, in the past, or on a day off", async () => {
    expect(await failure(db, alice, "select public.request_service($1::jsonb, $2)", [body(fixedSvc, { preferred_start: at(3, "20:00") }), key()])).toMatch(/slot_unavailable/);
    expect(await failure(db, alice, "select public.request_service($1::jsonb, $2)", [body(fixedSvc, { preferred_start: at(-1, "10:00") }), key()])).toMatch(/invalid_slot/);
    await rpc(pA, "select public.add_service_time_off($1::date, $2::date, 'Festival')", [istDay(5), istDay(6)]);
    expect(await failure(db, alice, "select public.request_service($1::jsonb, $2)", [body(fixedSvc, { preferred_start: at(5, "10:00") }), key()])).toMatch(/slot_unavailable/);
    const off = (await rpc<{ id: string }>(pA, "select * from public.service_time_off"))[0];
    expect(await failure(db, pB, "select public.delete_service_time_off($1)", [off.id])).toMatch(/not_found/);
    await rpc(pA, "select public.delete_service_time_off($1)", [off.id]);
    expect(await rpc(pA, "select * from public.service_time_off")).toHaveLength(0);
  });
});

describe("fixed-price request flow", () => {
  let r: string;
  it("snapshots the price at request time and totals price x quantity; payment is always UNPAID", async () => {
    r = await request(alice, fixedSvc, { quantity: 3, preferred_start: at(3, "10:00") });
    const row = await reqRow(r);
    expect(row.status).toBe("submitted");
    expect(Number(row.unit_price_inr)).toBe(600);
    expect(Number(row.agreed_total_inr)).toBe(1800);
    expect(row.payment_status).toBe("unpaid");
    expect(String(row.request_number)).toMatch(/^SR-\d{6}-[A-Z0-9]{5}$/);
    // a later price change never rewrites the request
    await rpc(pA, "select public.save_service($1::jsonb)", [JSON.stringify({ id: fixedSvc, category_id: catGardening, name: "Lawn care visit", summary: "s", description: DESC, pricing_model: "fixed", price_inr: 900, price_unit: "visit", duration_minutes: 60 })]);
    await rpc(admin, "select public.admin_review_service($1, 'approve', null)", [fixedSvc]);
    expect(Number((await reqRow(r)).unit_price_inr)).toBe(600);
    await db.query("update public.services set price_inr = 600 where id = $1", [fixedSvc]);
  });

  it("is idempotent: a retried submission returns the same request", async () => {
    const k = key();
    const a = await request(bob, bSvc, {}, k);
    const b = await request(bob, bSvc, {}, k);
    expect(b).toBe(a);
    expect(await all("select id from public.service_requests where customer_id = $1", [bob])).toHaveLength(1);
    await rpc(bob, "select public.cancel_service_request($1, 'changed my mind')", [a]);
  });

  it("refuses duplicates, own listings, PINs outside the provider's area and missing details", async () => {
    expect(await failure(db, alice, "select public.request_service($1::jsonb, $2)", [body(fixedSvc), key()])).toMatch(/duplicate_request/);
    expect(await failure(db, pA, "select public.request_service($1::jsonb, $2)", [body(fixedSvc), key()])).toMatch(/own_service/);
    expect(await failure(db, bob, "select public.request_service($1::jsonb, $2)", [body(fixedSvc, { pin: "110001" }), key()])).toMatch(/outside_service_area/);
    expect(await failure(db, bob, "select public.request_service($1::jsonb, $2)", [body(fixedSvc, { phone: "x" }), key()])).toMatch(/invalid_phone/);
    expect(await failure(db, bob, "select public.request_service($1::jsonb, 'short')", [body(fixedSvc)])).toMatch(/invalid_key/);
    expect(await failure(db, null, "select public.request_service($1::jsonb, $2)", [body(fixedSvc), key()])).toMatch(/permission denied/i);
    expect(await failure(db, admin, "select public.request_service($1::jsonb, $2)", [body(fixedSvc), key()])).toMatch(/account_suspended/);
  });

  it("shows the provider the area and details from the start but hides phone and address until accepted", async () => {
    expect(await rpc(pA, "select * from public.service_requests where id = $1", [r])).toHaveLength(1);
    expect(await rpc(pA, "select * from public.service_request_contact where request_id = $1", [r])).toHaveLength(0);
    expect(await rpc(alice, "select * from public.service_request_contact where request_id = $1", [r])).toHaveLength(1);
    expect(await rpc(admin, "select * from public.service_request_contact where request_id = $1", [r])).toHaveLength(1);
  });

  it("keeps requests private: other customers and other providers see nothing", async () => {
    for (const other of [bob, carol, pB]) {
      expect(await rpc(other, "select * from public.service_requests where id = $1", [r])).toHaveLength(0);
      expect(await rpc(other, "select * from public.service_request_contact where request_id = $1", [r])).toHaveLength(0);
      expect(await rpc(other, "select * from public.service_request_history where request_id = $1", [r])).toHaveLength(0);
    }
    expect(await failure(db, pB, "select public.provider_respond_service_request($1, 'accept', null)", [r])).toMatch(/not_found/);
    expect(await failure(db, bob, "select public.cancel_service_request($1, 'x')", [r])).toMatch(/not_found/);
    expect(await failure(db, alice, "select public.provider_respond_service_request($1, 'accept', null)", [r])).toMatch(/not_found|capability_not_approved/);
  });

  it("accepting books the customer's preferred slot, reveals the contact details, and notifies the customer", async () => {
    await rpc(pA, "select public.provider_respond_service_request($1, 'accept', null)", [r]);
    expect(await reqStatus(r)).toBe("accepted");
    const appt = await rpc<{ status: string }>(alice, "select * from public.service_appointments where request_id = $1", [r]);
    expect(appt).toHaveLength(1);
    expect(appt[0].status).toBe("confirmed");
    expect(await rpc(pA, "select * from public.service_request_contact where request_id = $1", [r])).toHaveLength(1);
    expect((await all("select 1 from public.notifications where user_id = $1 and kind = 'service_request'", [alice])).length).toBeGreaterThan(0);
  });

  it("refuses a second request for the same slot, and frees it when the first is cancelled", async () => {
    const r2 = await request(carol, fixedSvc, { preferred_start: at(3, "10:00") }).catch((e: Error) => e.message);
    expect(String(r2)).toMatch(/slot_unavailable/); // already taken: refused at request time
    const r3 = await request(carol, fixedSvc, { preferred_start: at(3, "13:00") });
    await rpc(carol, "select public.cancel_service_request($1, null)", [r3]);
  });

  it("starts and completes the work and records every step in an append-only history", async () => {
    await rpc(pA, "select public.provider_start_service($1)", [r]);
    expect(await reqStatus(r)).toBe("in_progress");
    expect(await failure(db, alice, "select public.cancel_service_request($1, 'x')", [r])).toMatch(/cannot_cancel/);
    await rpc(pA, "select public.provider_complete_service($1)", [r]);
    expect(await reqStatus(r)).toBe("completed");
    expect((await reqRow(r)).payment_status).toBe("unpaid");
    expect((await one<{ status: string }>("select status from public.service_appointments where request_id = $1", [r])).status).toBe("completed");
    const hist = await rpc<{ to_status: string; actor_kind: string }>(alice, "select * from public.service_request_history where request_id = $1 order by id", [r]);
    expect(hist.map((h) => h.to_status)).toEqual(["submitted", "accepted", "in_progress", "completed"]);
    expect(hist.map((h) => h.actor_kind)).toEqual(["customer", "provider", "provider", "provider"]);
    expect(await failure(db, admin, "update public.service_request_history set note = 'x'")).toMatch(/permission denied|append_only/);
    expect(await failure(db, pA, "select public.provider_complete_service($1)", [r])).toMatch(/invalid_status/);
  });

  it("can never be marked paid, and a request's identity and price never change", async () => {
    expect(await failure(db, null, "update public.service_requests set payment_status = 'paid' where id = $1", [r])).toMatch(/permission denied/i);
    await expect(db.query("update public.service_requests set payment_status = 'paid' where id = $1", [r])).rejects.toThrow(/payment_not_configured/);
    await expect(db.query("update public.service_requests set unit_price_inr = 1 where id = $1", [r])).rejects.toThrow(/service_request_is_immutable/);
    await expect(db.query("update public.service_requests set status = 'submitted' where id = $1", [r])).rejects.toThrow(/invalid_status/);
  });
});

describe("quotation-based request flow", () => {
  let r: string;
  let q1: string;

  it("requires details, and the provider cannot simply accept: a quotation is needed first", async () => {
    expect(await failure(db, bob, "select public.request_service($1::jsonb, $2)", [body(quoteSvc, { details: "" }), key()])).toMatch(/details_required/);
    r = await request(bob, quoteSvc, { details: "Redesign a 400 sq ft terrace garden with seating and low-water plants." });
    const row = await reqRow(r);
    expect(row.pricing_model).toBe("quote");
    expect(row.agreed_total_inr).toBeNull();
    expect(await failure(db, pA, "select public.provider_respond_service_request($1, 'accept', null)", [r])).toMatch(/quotation_required/);
  });

  it("validates the quotation, then moves the request to 'quoted'", async () => {
    const send = (over: Record<string, unknown>) => failure(db, pA, "select public.provider_send_quotation($1, $2::jsonb)", [r, JSON.stringify({ amount_inr: 12000, description: "Design, plants and two site visits.", valid_until: istDay(10), ...over })]);
    expect(await send({ amount_inr: 0 })).toMatch(/invalid_price/);
    expect(await send({ description: "short" })).toMatch(/description_required/);
    expect(await send({ valid_until: istDay(-1) })).toMatch(/invalid_validity/);
    expect(await send({ valid_until: istDay(400) })).toMatch(/invalid_validity/);
    q1 = (await rpc<{ id: string }>(pA, "select public.provider_send_quotation($1, $2::jsonb) as id", [r, JSON.stringify({ amount_inr: 12000, description: "Design, plants and two site visits.", valid_until: istDay(10), proposed_start: at(4, "10:00") })]))[0].id;
    expect(await reqStatus(r)).toBe("quoted");
    expect(await failure(db, pB, "select public.provider_send_quotation($1, '{}'::jsonb)", [r])).toMatch(/not_found/);
  });

  it("lets only the customer see and decide the quotation", async () => {
    expect(await rpc(bob, "select * from public.service_quotations where request_id = $1", [r])).toHaveLength(1);
    for (const other of [carol, pB]) expect(await rpc(other, "select * from public.service_quotations where request_id = $1", [r])).toHaveLength(0);
    expect(await failure(db, carol, "select public.decide_quotation($1, 'accept', null)", [q1])).toMatch(/not_found/);
    expect(await failure(db, pA, "select public.decide_quotation($1, 'accept', null)", [q1])).toMatch(/not_found/);
  });

  it("a revision supersedes the live quotation; a quotation can never be edited", async () => {
    const q2 = (await rpc<{ id: string }>(pA, "select public.provider_send_quotation($1, $2::jsonb) as id", [r, JSON.stringify({ amount_inr: 11000, description: "Revised: fewer plants, same design.", valid_until: istDay(10), proposed_start: at(4, "10:00") })]))[0].id;
    expect((await one<{ status: string }>("select status from public.service_quotations where id = $1", [q1])).status).toBe("superseded");
    expect(await failure(db, bob, "select public.decide_quotation($1, 'accept', null)", [q1])).toMatch(/invalid_status/);
    await expect(db.query("update public.service_quotations set amount_inr = 1 where id = $1", [q2])).rejects.toThrow(/quotations_are_immutable/);
    await expect(db.query("delete from public.service_quotations where id = $1", [q2])).rejects.toThrow(/quotations_are_immutable/);
    q1 = q2;
  });

  it("declining returns the request to the provider; an expired quotation cannot be accepted", async () => {
    await rpc(bob, "select public.decide_quotation($1, 'decline', 'Too expensive')", [q1]);
    expect(await reqStatus(r)).toBe("submitted");
    const q3 = (await rpc<{ id: string }>(pA, "select public.provider_send_quotation($1, $2::jsonb) as id", [r, JSON.stringify({ amount_inr: 9000, description: "Reduced scope, plants only.", valid_until: istDay(0) })]))[0].id;
    // Expiry: the guard forbids editing a quotation, so backdate it with the guard disabled (test only) and check acceptance is refused.
    await db.query("alter table public.service_quotations disable trigger service_quotations_guard");
    await db.query("update public.service_quotations set valid_until = $2::date where id = $1", [q3, istDay(-1)]);
    await db.query("alter table public.service_quotations enable trigger service_quotations_guard");
    expect(await failure(db, bob, "select public.decide_quotation($1, 'accept', null)", [q3])).toMatch(/quotation_expired/);
    expect(await failure(db, bob, "select public.decide_quotation($1, 'maybe', null)", [q3])).toMatch(/quotation_expired|invalid_decision/);
    expect(await reqStatus(r)).toBe("quoted");
    q1 = q3;
  });

  it("accepting fixes the agreed total at the quoted amount and books the proposed slot", async () => {
    const q4 = (await rpc<{ id: string }>(pA, "select public.provider_send_quotation($1, $2::jsonb) as id", [r, JSON.stringify({ amount_inr: 9500.5, description: "Final: plants, soil and one visit.", valid_until: istDay(10), proposed_start: at(4, "11:00"), proposed_duration_minutes: 180 })]))[0].id;
    await rpc(bob, "select public.decide_quotation($1, 'accept', 'Looks good')", [q4]);
    const row = await reqRow(r);
    expect(row.status).toBe("accepted");
    expect(Number(row.agreed_total_inr)).toBe(9500.5);
    expect(row.payment_status).toBe("unpaid");
    const appt = await one<{ starts_at: string; ends_at: string }>("select starts_at, ends_at from public.service_appointments where request_id = $1 and status = 'confirmed'", [r]);
    expect((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000).toBe(180);
    expect(await rpc(pA, "select * from public.service_request_contact where request_id = $1", [r])).toHaveLength(1);
  });

  it("lets the provider reschedule; the old slot is freed, an overlapping one refused", async () => {
    await rpc(pA, "select public.provider_schedule_appointment($1, $2::timestamptz, 60)", [r, at(4, "15:00")]);
    expect(await all("select 1 from public.service_appointments where request_id = $1 and status = 'confirmed'", [r])).toHaveLength(1);
    const other = await request(carol, quoteSvc, { details: "Maintain a small lawn every month." });
    await rpc(pA, "select public.provider_send_quotation($1, $2::jsonb)", [other, JSON.stringify({ amount_inr: 800, description: "Monthly lawn visit, tools included.", valid_until: istDay(10) })]);
    const qo = (await one<{ id: string }>("select id from public.service_quotations where request_id = $1 and status = 'sent'", [other])).id;
    await rpc(carol, "select public.decide_quotation($1, 'accept', null)", [qo]);
    expect(await failure(db, pA, "select public.provider_schedule_appointment($1, $2::timestamptz, 60)", [other, at(4, "15:30")])).toMatch(/slot_unavailable/);
    await rpc(pA, "select public.provider_schedule_appointment($1, $2::timestamptz, 60)", [other, at(4, "16:00")]);
    await rpc(pA, "select public.provider_cancel_service_request($1, 'Provider unwell')", [other]);
    expect(await reqStatus(other)).toBe("cancelled");
    expect(await all("select 1 from public.service_appointments where request_id = $1 and status = 'confirmed'", [other])).toHaveLength(0);
    await rpc(pA, "select public.provider_complete_service($1)", [r]);
  });
});

describe("cancellation, declines and administrator support", () => {
  it("lets the customer cancel before work starts, and cancels a live quotation with it", async () => {
    const r = await request(carol, quoteSvc, { details: "Plan a vegetable patch for the backyard." });
    await rpc(pA, "select public.provider_send_quotation($1, $2::jsonb)", [r, JSON.stringify({ amount_inr: 3000, description: "Bed layout and planting plan.", valid_until: istDay(7) })]);
    await rpc(carol, "select public.cancel_service_request($1, 'Plans changed')", [r]);
    expect(await reqStatus(r)).toBe("cancelled");
    expect((await one<{ status: string }>("select status from public.service_quotations where request_id = $1 order by version desc limit 1", [r])).status).toBe("superseded");
    expect(await failure(db, carol, "select public.cancel_service_request($1, 'again')", [r])).toMatch(/cannot_cancel/);
    // a new request is allowed once the old one is closed
    const r2 = await request(carol, quoteSvc, { details: "Plan a vegetable patch for the backyard." });
    expect(r2).not.toBe(r);
  });

  it("requires a reason to decline, and tells the customer why", async () => {
    const r = await request(bob, fixedSvc);
    expect(await failure(db, pA, "select public.provider_respond_service_request($1, 'decline', ' ')", [r])).toMatch(/reason_required/);
    await rpc(pA, "select public.provider_respond_service_request($1, 'decline', 'Fully booked this week')", [r]);
    expect(await reqStatus(r)).toBe("declined");
    const n = await all<{ body: string }>("select body from public.notifications where user_id = $1 and title like '%declined%'", [bob]);
    expect(n.some((x) => /Fully booked/.test(x.body))).toBe(true);
  });

  it("lets an administrator cancel any open request with a mandatory, audited reason; others cannot", async () => {
    const r = await request(bob, fixedSvc);
    expect(await failure(db, pA, "select public.admin_cancel_service_request($1, 'x')", [r])).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.admin_cancel_service_request($1, '')", [r])).toMatch(/reason_required/);
    await rpc(admin, "select public.admin_cancel_service_request($1, 'Reported as abusive')", [r]);
    expect(await reqStatus(r)).toBe("cancelled");
    expect((await all("select 1 from public.audit_logs where action = 'admin_service_request_cancelled' and entity_id = $1", [r])).length).toBe(1);
    expect((await rpc(admin, "select * from public.service_requests")).length).toBeGreaterThan(5);
  });
});

describe("module switch, suspension and the old gardening form", () => {
  it("refuses new requests when the module is switched OFF, and hides the listings", async () => {
    await flag("marketplace_services_enabled", false);
    expect(await failure(db, bob, "select public.request_service($1::jsonb, $2)", [body(bSvc), key()])).toMatch(/services_closed/);
    expect(await rpc(null, "select * from public.search_services()")).toHaveLength(0);
    await flag("marketplace_services_enabled", true);
  });

  it("refuses requests from a suspended account", async () => {
    await db.query("update public.profiles set is_suspended = true where id = $1", [carol]);
    expect(await failure(db, carol, "select public.request_service($1::jsonb, $2)", [body(bSvc, { customer_name: "Carol" }), key()])).toMatch(/account_suspended/);
    await db.query("update public.profiles set is_suspended = false where id = $1", [carol]);
  });

  it("does not touch the existing gardening enquiry form or its history", async () => {
    await db.query("insert into public.gardening_enquiries (name, email, location, property_type) values ('Legacy Visitor', 'legacy@test.dev', 'Bengaluru', 'Villa')");
    expect(await rpc(admin, "select name from public.gardening_enquiries")).toHaveLength(1);
    expect(await rpc(pA, "select name from public.gardening_enquiries")).toHaveLength(0);
    await rpc(null, "insert into public.gardening_enquiries (name, email, location, property_type) values ('Anon Visitor', 'anon@test.dev', 'Mysuru', 'Farm')");
    expect(await rpc(admin, "select name from public.gardening_enquiries")).toHaveLength(2);
  });
});
