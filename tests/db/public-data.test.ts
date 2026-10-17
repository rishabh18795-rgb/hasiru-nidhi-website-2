import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, dayOffset, failure, insertApprovedProperty, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;
let host: string;
let guest: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  admin = await makeAdmin(db, "admin@example.test");
  host = await createUser(db, "host@example.test", { account_type: "host" });
  guest = await createUser(db, "guest@example.test", { full_name: "Guest" });
});

const search = (args: Record<string, unknown> = {}) => {
  const keys = Object.keys(args);
  const named = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  return as<{ slug: string; total_count: string; price_inr: string | null }>(
    db, null, `select slug, total_count, price_inr from public.search_properties(${named})`, Object.values(args));
};

describe("seed data", () => {
  it("loads three clearly-flagged sample listings and nothing else", async () => {
    const rows = await as<{ is_sample: boolean }>(db, null, "select is_sample from public.properties");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.is_sample)).toBe(true);
  });

  it("ships catalogue vocabulary but invents no reviews, bookings or users", async () => {
    expect((await db.query("select 1 from public.reviews")).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.bookings")).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.profiles")).rows.length).toBeLessThanOrEqual(3); // only the users created in this file (admin, host, guest)
    expect((await db.query("select 1 from public.property_categories")).rows.length).toBeGreaterThanOrEqual(6);
  });

  it("leaves the WhatsApp number and contact settings EMPTY (never invented)", async () => {
    const rows = await as<{ value: unknown }>(db, null, "select value from public.platform_settings where key = 'whatsapp_number'");
    expect(rows[0].value).toBe("");
  });
});

describe("search_properties", () => {
  it("returns approved listings, newest/featured first, with a total count", async () => {
    const rows = await search();
    expect(rows).toHaveLength(3);
    expect(Number(rows[0].total_count)).toBe(3);
    expect(rows[0].slug).toBe("sample-farmhouse-room"); // featured sorts first
  });

  it("matches by text across name, city and region", async () => {
    expect((await search({ p_query: "ramanagara" })).map((r) => r.slug)).toEqual(["sample-cycling-eco-retreat"]);
    expect((await search({ p_query: "cottage" })).map((r) => r.slug)).toEqual(["sample-garden-cottage"]);
    expect(await search({ p_query: "nowhere-at-all" })).toHaveLength(0);
  });

  it("filters by category slug", async () => {
    expect((await search({ p_category: "cottage" })).map((r) => r.slug)).toEqual(["sample-garden-cottage"]);
  });

  it("filters by guest capacity", async () => {
    expect((await search({ p_guests: 10 })).map((r) => r.slug)).toEqual(["sample-cycling-eco-retreat"]);
  });

  it("budget filters only match listings that have a price", async () => {
    const cheap = (await search({ p_max_price: 5000 })).map((r) => r.slug);
    expect(cheap).toEqual(["sample-farmhouse-room"]);
    const none = await search({ p_min_price: 100000 });
    expect(none).toHaveLength(0);
  });

  it("amenity filter requires ALL selected amenities", async () => {
    expect((await search({ p_amenities: ["bonfire", "bicycles"] })).map((r) => r.slug)).toEqual(["sample-garden-cottage"]);
    expect(await search({ p_amenities: ["bonfire", "swimming-pool"] })).toHaveLength(0);
  });

  it("experience filter matches ANY selected experience", async () => {
    const slugs = (await search({ p_experiences: ["stargazing", "village-walk"] })).map((r) => r.slug).sort();
    expect(slugs).toEqual(["sample-cycling-eco-retreat", "sample-garden-cottage"]);
  });

  it("sorts by price, with unpriced listings last", async () => {
    expect((await search({ p_sort: "price_asc" })).map((r) => r.slug)).toEqual([
      "sample-farmhouse-room", "sample-garden-cottage", "sample-cycling-eco-retreat"]);
    expect((await search({ p_sort: "price_desc" })).map((r) => r.slug)[0]).toBe("sample-garden-cottage");
  });

  it("paginates and reports the full total", async () => {
    const page = await search({ p_limit: 2, p_offset: 2 });
    expect(page).toHaveLength(1);
    expect(Number(page[0].total_count)).toBe(3);
  });

  it("excludes listings that are not available for the chosen dates", async () => {
    const prop = await insertApprovedProperty(db, host, { slug: "avail-test", name: "Availability Test", price: 3000 });
    const [{ request_booking: id }] = await as<{ request_booking: string }>(
      db, guest, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(40), dayOffset(43)]);
    await as(db, host, "select public.respond_to_booking($1, true, null)", [id]);
    const clash = await search({ p_query: "Availability Test", p_check_in: dayOffset(41), p_check_out: dayOffset(42) });
    const free = await search({ p_query: "Availability Test", p_check_in: dayOffset(43), p_check_out: dayOffset(45) });
    expect(clash).toHaveLength(0);
    expect(free).toHaveLength(1);
  });

  it("never returns drafts, pending or suspended listings", async () => {
    await db.query(
      "insert into public.properties (host_id, slug, name, status) values ($1, 'hidden-draft', 'Hidden Draft Place', 'draft')", [host]);
    expect(await search({ p_query: "Hidden Draft" })).toHaveLength(0);
  });
});

describe("enquiries persist and stay private", () => {
  it("anonymous visitors can submit a contact enquiry, but cannot read any", async () => {
    await as(db, null,
      "insert into public.contact_enquiries (kind, name, email, message) values ('general', 'Visitor', 'v@example.test', 'Hello there')");
    expect(await as(db, null, "select id from public.contact_enquiries")).toHaveLength(0);
    expect(await as(db, guest, "select id from public.contact_enquiries")).toHaveLength(0);
    expect((await as(db, admin, "select id from public.contact_enquiries")).length).toBe(1);
  });

  it("requires at least a phone or an e-mail, and rejects absurd lengths or forged status", async () => {
    expect(await failure(db, null, "insert into public.contact_enquiries (name, message) values ('A', 'message here')")).toMatch(/reachable|violates/);
    expect(await failure(db, null, "insert into public.contact_enquiries (name, email, message) values ('A','a@b.co', repeat('x', 6000))")).toMatch(/violates/);
    expect(await failure(db, null, "insert into public.contact_enquiries (name, email, message, status) values ('A','a@b.co','hello there','resolved')")).toMatch(/row-level security/);
    expect(await failure(db, null, "insert into public.contact_enquiries (name, email, message, admin_notes) values ('A','a@b.co','hello there','pwned')")).toMatch(/row-level security/);
  });

  it("a signed-in user cannot submit an enquiry as someone else", async () => {
    const other = await createUser(db, "other@example.test");
    expect(await failure(db, guest,
      "insert into public.contact_enquiries (name, email, message, user_id) values ('A','a@b.co','hello there',$1)", [other])).toMatch(/row-level security/);
  });

  it("gardening enquiries and partner applications persist and are admin-readable only", async () => {
    await as(db, null,
      `insert into public.gardening_enquiries (name, phone, location, property_type, services, budget_range)
       values ('Meera', '+919000000003', 'Whitefield', 'Villa', array['lawn','vertical-garden'], '50k-1L')`);
    await as(db, null,
      `insert into public.partner_applications (owner_name, email, phone, property_name, city, consent_at)
       values ('Owner', 'o@example.test', '+919000000004', 'Green Acres', 'Mysuru', now())`);
    expect(await as(db, null, "select id from public.gardening_enquiries")).toHaveLength(0);
    expect(await as(db, null, "select id from public.partner_applications")).toHaveLength(0);
    expect(await as(db, admin, "select id from public.gardening_enquiries")).toHaveLength(1);
    expect(await as(db, admin, "select id from public.partner_applications")).toHaveLength(1);
  });

  it("a partner application without privacy consent is impossible", async () => {
    expect(await failure(db, null,
      `insert into public.partner_applications (owner_name, email, phone, property_name, city)
       values ('O', 'o@example.test', '+919000000004', 'X', 'Y')`)).toMatch(/violates not-null|consent/);
  });

  it("admins can triage enquiries; others cannot", async () => {
    const [{ id }] = await as<{ id: string }>(db, admin, "select id from public.contact_enquiries limit 1");
    await as(db, admin, "update public.contact_enquiries set status = 'in_progress', admin_notes = 'Called back' where id = $1", [id]);
    const changed = await as(db, guest, "update public.contact_enquiries set status = 'resolved' where id = $1 returning id", [id]);
    expect(changed).toHaveLength(0);
  });
});

describe("reports", () => {
  it("can be filed only against live listings and read only by admins", async () => {
    const [{ id }] = await as<{ id: string }>(db, null, "select id from public.properties where slug = 'sample-garden-cottage'");
    await as(db, guest, "insert into public.reports (property_id, reporter_id, reason, details) values ($1,$2,'Inaccurate photos','Does not match')", [id, guest]);
    expect(await as(db, guest, "select id from public.reports")).toHaveLength(0);
    expect(await as(db, admin, "select id from public.reports")).toHaveLength(1);
    const draft = (await db.query<{ id: string }>("select id from public.properties where slug = 'hidden-draft'")).rows[0].id;
    expect(await failure(db, guest, "insert into public.reports (property_id, reason) values ($1, 'x')", [draft])).toMatch(/row-level security/);
  });
});

describe("notifications", () => {
  it("users read only their own, can mark read, but cannot forge or edit content", async () => {
    const mine = await as<{ id: string }>(db, guest, "select id from public.notifications");
    expect(mine.length).toBeGreaterThan(0);
    expect(await as(db, host, "select id from public.notifications where user_id = $1", [guest])).toHaveLength(0);

    await as(db, guest, "update public.notifications set is_read = true where id = $1", [mine[0].id]);
    expect(await failure(db, guest, "update public.notifications set title = 'forged' where id = $1", [mine[0].id])).toMatch(/permission denied/);
    expect(await failure(db, guest, "insert into public.notifications (user_id, kind, title) values ($1, 'x', 'spam')", [guest])).toMatch(/permission denied/);
    expect(await failure(db, guest, "delete from public.notifications where id = $1", [mine[0].id])).toMatch(/permission denied/);
  });

  it("internal notify helpers are not callable by clients", async () => {
    expect(await failure(db, guest, "select public.notify($1, 'x', 'y', 'z', '/')", [guest])).toMatch(/permission denied/);
    expect(await failure(db, guest, "select public.notify_admins('x','y','z','/')")).toMatch(/permission denied/);
    expect(await failure(db, guest, "select public.write_audit('x','y','z','{}'::jsonb)")).toMatch(/permission denied/);
  });
});

describe("saved properties", () => {
  it("lets users save live listings for themselves only", async () => {
    const [{ id }] = await as<{ id: string }>(db, null, "select id from public.properties where slug = 'sample-garden-cottage'");
    await as(db, guest, "insert into public.saved_properties (user_id, property_id) values ($1,$2)", [guest, id]);
    expect(await as(db, guest, "select property_id from public.saved_properties")).toHaveLength(1);
    expect(await as(db, host, "select property_id from public.saved_properties")).toHaveLength(0);
    expect(await failure(db, host, "insert into public.saved_properties (user_id, property_id) values ($1,$2)", [guest, id])).toMatch(/row-level security/);
  });

  it("cannot save a draft listing", async () => {
    const draft = (await db.query<{ id: string }>("select id from public.properties where slug = 'hidden-draft'")).rows[0].id;
    expect(await failure(db, guest, "insert into public.saved_properties (user_id, property_id) values ($1,$2)", [guest, draft])).toMatch(/row-level security/);
  });
});

describe("platform settings and audit log", () => {
  it("public settings are readable by anyone, writable only by admins", async () => {
    expect((await as(db, null, "select key from public.platform_settings")).length).toBeGreaterThanOrEqual(4);
    expect(await as(db, guest, "update public.platform_settings set value = '\"9999\"'::jsonb where key = 'whatsapp_number' returning key")).toHaveLength(0);
    await as(db, admin, "update public.platform_settings set value = '\"919000000099\"'::jsonb where key = 'whatsapp_number'");
    const [row] = await as<{ value: string }>(db, null, "select value from public.platform_settings where key = 'whatsapp_number'");
    expect(row.value).toBe("919000000099");
  });

  it("private settings stay private", async () => {
    await db.query("insert into public.platform_settings (key, value, is_public) values ('internal_secret', '\"s3\"', false)");
    expect(await as(db, null, "select key from public.platform_settings where key = 'internal_secret'")).toHaveLength(0);
    expect(await as(db, admin, "select key from public.platform_settings where key = 'internal_secret'")).toHaveLength(1);
  });

  it("the audit log is admin-readable and cannot be written or altered by anyone via the API", async () => {
    expect(await as(db, guest, "select id from public.audit_logs")).toHaveLength(0);
    expect(await failure(db, admin, "insert into public.audit_logs (action, entity_type) values ('x','y')")).toMatch(/permission denied/);
    expect(await failure(db, admin, "delete from public.audit_logs")).toMatch(/permission denied/);
  });

  it("admin catalogue management works; others are blocked", async () => {
    await as(db, admin, "insert into public.amenities (slug, name) values ('sauna', 'Sauna')");
    expect(await failure(db, host, "insert into public.amenities (slug, name) values ('sneaky', 'Sneaky')")).toMatch(/row-level security/);
    await as(db, admin, "update public.amenities set is_active = false where slug = 'sauna'");
    expect(await as(db, null, "select slug from public.amenities where slug = 'sauna'")).toHaveLength(0);
  });
});
