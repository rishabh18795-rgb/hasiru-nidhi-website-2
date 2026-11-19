import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

/**
 * M1 vendor foundation: identity, capabilities, verification documents, coverage, feature flags and isolation between vendors.
 * Runs the REAL migrations in-process, with real rows and test identities.
 */
let db: Db;
let admin: string;
let alice: string; // aspiring vendor
let bob: string; // another vendor
let carol: string; // plain customer
let hostUser: string; // existing stay host (grandfathered)

const PROFILE = {
  business_name: "Green Roots Nursery", business_type: "proprietorship", description: "Saplings and seeds.", contact_name: "Alice Rao",
  contact_email: "Alice@Example.com", contact_phone: "+919876543210", address_line: "12 Garden Road", city: "Bengaluru", state: "Karnataka", postal_code: "560078",
};

const flag = (key: string, value: boolean) => db.query("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);
const save = (user: string, p: Record<string, unknown> = PROFILE) => as<{ id: string }>(db, user, "select public.save_vendor_profile($1::jsonb) as id", [JSON.stringify(p)]).then((r) => r[0].id);
const submit = (user: string, caps: string[]) => as(db, user, "select public.submit_vendor_application($1::public.vendor_capability[])", [`{${caps.join(",")}}`]);
const review = (user: string, vendor: string, decision: string, reason: string | null = null) => as(db, user, "select public.admin_review_vendor($1,$2,$3)", [vendor, decision, reason]);
const reviewCap = (user: string, vendor: string, cap: string, decision: string, reason: string | null = null) => as(db, user, "select public.admin_review_capability($1,$2,$3,$4)", [vendor, cap, decision, reason]);
const one = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const can = async (vendor: string, cap: string) => (await one<{ v: boolean }>("select public.vendor_can($1, $2) as v", [vendor, cap])).v;

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@test.dev");
  alice = await createUser(db, "alice@test.dev", { full_name: "Alice" });
  bob = await createUser(db, "bob@test.dev", { full_name: "Bob" });
  carol = await createUser(db, "carol@test.dev", { full_name: "Carol" });
  hostUser = await createUser(db, "host@test.dev", { full_name: "Hema Host", account_type: "host" });
});

describe("feature flags", () => {
  it("are all OFF by default and public, and accept only booleans", async () => {
    const rows = (await db.query<{ key: string; value: unknown; is_public: boolean }>("select key, value, is_public from public.platform_settings where key like 'marketplace_%' order by key")).rows;
    expect(rows.map((r) => [r.key, r.value, r.is_public])).toEqual([
      ["marketplace_products_enabled", false, true],
      ["marketplace_services_enabled", false, true],
      ["marketplace_vendor_registration_enabled", false, true],
    ]);
    await expect(db.query("update public.platform_settings set value = '\"yes\"'::jsonb where key = 'marketplace_products_enabled'")).rejects.toThrow(/invalid_setting/);
  });
  it("can be read by anyone but changed only by an administrator", async () => {
    expect((await as(db, null, "select key from public.platform_settings where key = 'marketplace_products_enabled'")).length).toBe(1);
    const denied = await as(db, carol, "update public.platform_settings set value = 'true'::jsonb where key = 'marketplace_products_enabled' returning key");
    expect(denied).toHaveLength(0);
    expect((await one<{ value: boolean }>("select value from public.platform_settings where key = 'marketplace_products_enabled'")).value).toBe(false);
  });
  it("registration is closed until the flag is on", async () => {
    expect(await failure(db, alice, "select public.save_vendor_profile($1::jsonb)", [JSON.stringify(PROFILE)])).toMatch(/vendor_registration_closed/);
    await flag("marketplace_vendor_registration_enabled", true);
  });
});

describe("vendor profile and application", () => {
  let vendor: string;
  it("a customer becomes a vendor draft WITHOUT any change to their account role", async () => {
    vendor = await save(alice);
    const v = await one<{ status: string; owner_id: string; contact_email: string; slug: string }>("select * from public.vendors where id = $1", [vendor]);
    expect(v.status).toBe("draft");
    expect(v.owner_id).toBe(alice);
    expect(v.contact_email).toBe("alice@example.com");
    expect(v.slug).toMatch(/^green-roots-nursery-[0-9a-f]{6}$/);
    expect((await one<{ role: string }>("select role from public.profiles where id = $1", [alice])).role).toBe("traveller");
    expect(await save(alice, { ...PROFILE, description: "Updated." })).toBe(vendor); // same vendor, no second row
  });
  it("rejects a bad PIN and a bad business type", async () => {
    expect(await failure(db, bob, "select public.save_vendor_profile($1::jsonb)", [JSON.stringify({ ...PROFILE, postal_code: "56007" })])).toMatch(/invalid_pin/);
    expect(await failure(db, bob, "select public.save_vendor_profile($1::jsonb)", [JSON.stringify({ ...PROFILE, business_type: "spaceship" })])).toMatch(/invalid_business_type/);
  });
  it("clients cannot write the vendor tables directly, approve themselves, or read other vendors", async () => {
    expect(await failure(db, alice, "update public.vendors set status = 'approved' where id = $1", [vendor])).toMatch(/permission denied/);
    expect(await failure(db, alice, "insert into public.vendor_capabilities (vendor_id, capability, status) values ($1, 'products', 'approved')", [vendor])).toMatch(/permission denied/);
    expect(await failure(db, alice, "select public.admin_review_vendor($1, 'approve', null)", [vendor])).toMatch(/forbidden/);
    await save(bob, { ...PROFILE, business_name: "Bob's Tools", contact_email: "bob@example.com" });
    expect(await as(db, alice, "select id from public.vendors")).toHaveLength(1);
    expect(await as(db, bob, "select id from public.vendors")).toHaveLength(1);
    expect(await as(db, carol, "select id from public.vendors")).toHaveLength(0);
    expect(await as(db, null, "select 1").catch(() => [])).toBeDefined();
    expect(await failure(db, null, "select id from public.vendors")).toMatch(/permission denied/);
    expect(await as(db, admin, "select id from public.vendors")).toHaveLength(2);
  });
  it("cannot be submitted until the profile is complete and required documents are uploaded", async () => {
    const incomplete = await save(carol, { business_name: "Carol Crafts" });
    expect(incomplete).toBeTruthy();
    expect(await failure(db, carol, "select public.submit_vendor_application('{products}'::public.vendor_capability[])")).toMatch(/incomplete_vendor: .*contact_phone/);
    expect(await failure(db, alice, "select public.submit_vendor_application('{}'::public.vendor_capability[])")).toMatch(/capability_required/);

    const req = await one<{ id: number }>("insert into public.vendor_document_requirements (slug, name, capability) values ('id-proof', 'Identity proof', 'products') returning id");
    expect(await failure(db, alice, "select public.submit_vendor_application('{products}'::public.vendor_capability[])")).toMatch(/document:Identity proof/);
    await as(db, alice, "select public.register_vendor_document($1, 'Aadhaar', $2, 'id.pdf')", [req.id, `${vendor}/id.pdf`]);
    await submit(alice, ["products", "services"]);
    const v = await one<{ status: string; submitted_at: string | null }>("select status, submitted_at from public.vendors where id = $1", [vendor]);
    expect(v.status).toBe("submitted");
    expect(v.submitted_at).not.toBeNull();
    expect((await db.query("select capability, status from public.vendor_capabilities where vendor_id = $1 order by capability", [vendor])).rows).toEqual([
      { capability: "products", status: "pending" }, { capability: "services", status: "pending" },
    ]);
    expect((await db.query("select 1 from public.notifications where user_id = $1 and kind = 'vendor_submitted'", [admin])).rows.length).toBe(1);
  });
  it("is locked while it is in review", async () => {
    expect(await failure(db, alice, "select public.save_vendor_profile($1::jsonb)", [JSON.stringify(PROFILE)])).toMatch(/vendor_locked_in_review/);
    expect(await failure(db, alice, "select public.submit_vendor_application('{products}'::public.vendor_capability[])")).toMatch(/invalid_status/);
  });
});

describe("administrator review: vendor approval and capability approval are separate", () => {
  let vendor: string;
  beforeAll(async () => { vendor = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [alice])).id; });

  it("a capability cannot be approved before the vendor is", async () => {
    expect(await failure(db, admin, "select public.admin_review_capability($1, 'products', 'approve', null)", [vendor])).toMatch(/vendor_not_approved/);
    expect(await can(vendor, "products")).toBe(false);
  });
  it("approving the vendor does not approve any capability", async () => {
    await review(admin, vendor, "start_review");
    await review(admin, vendor, "approve");
    expect((await one<{ status: string }>("select status from public.vendors where id = $1", [vendor])).status).toBe("approved");
    expect(await can(vendor, "products")).toBe(false);
    expect(await can(vendor, "services")).toBe(false);
  });
  it("capabilities are approved one at a time", async () => {
    await reviewCap(admin, vendor, "products", "approve");
    expect(await can(vendor, "products")).toBe(true);
    expect(await can(vendor, "services")).toBe(false);
    expect(await failure(db, admin, "select public.admin_review_capability($1, 'services', 'reject', null)", [vendor])).toMatch(/reason_required/);
    await reviewCap(admin, vendor, "services", "reject", "Not enough information yet");
    expect(await can(vendor, "services")).toBe(false);
    expect(await failure(db, admin, "select public.admin_review_capability($1, 'products', 'approve', null)", [vendor])).toMatch(/invalid_status/);
  });
  it("owner access follows the capability, and admins always have it", async () => {
    expect((await one<{ v: boolean }>("select public.owns_vendor($1, 'products') as v", [vendor])).v).toBe(false); // postgres, no auth user
    expect((await as<{ v: boolean }>(db, alice, "select public.owns_vendor($1, 'products') as v", [vendor]))[0].v).toBe(true);
    expect((await as<{ v: boolean }>(db, alice, "select public.owns_vendor($1, 'services') as v", [vendor]))[0].v).toBe(false);
    expect((await as<{ v: boolean }>(db, bob, "select public.owns_vendor($1, 'products') as v", [vendor]))[0].v).toBe(false);
    expect((await as<{ v: boolean }>(db, admin, "select public.owns_vendor($1, 'services') as v", [vendor]))[0].v).toBe(true);
  });
  it("suspension removes access immediately and reinstatement restores it", async () => {
    expect(await failure(db, admin, "select public.admin_review_vendor($1, 'suspend', null)", [vendor])).toMatch(/reason_required/);
    await review(admin, vendor, "suspend", "Policy review");
    expect(await can(vendor, "products")).toBe(false);
    expect(await failure(db, alice, "select public.save_vendor_profile($1::jsonb)", [JSON.stringify(PROFILE)])).toMatch(/permission|suspended/);
    await review(admin, vendor, "reinstate");
    expect(await can(vendor, "products")).toBe(true);
    await reviewCap(admin, vendor, "products", "suspend", "Listing quality");
    expect(await can(vendor, "products")).toBe(false);
    await reviewCap(admin, vendor, "products", "reinstate");
    expect(await can(vendor, "products")).toBe(true);
  });
  it("a suspended account loses vendor membership", async () => {
    await db.query("update public.profiles set is_suspended = true where id = $1", [alice]);
    expect(await can(vendor, "products")).toBe(false);
    expect((await as<{ v: boolean }>(db, alice, "select public.is_vendor_member($1) as v", [vendor]))[0].v).toBe(false);
    await db.query("update public.profiles set is_suspended = false where id = $1", [alice]);
    expect(await can(vendor, "products")).toBe(true);
  });
  it("approved vendors can edit contact details but not the business name or tax identifier", async () => {
    await save(alice, { ...PROFILE, business_name: "Something Else", tax_identifier: "X", city: "Mysuru" });
    const v = await one<{ business_name: string; tax_identifier: string | null; city: string }>("select business_name, tax_identifier, city from public.vendors where id = $1", [vendor]);
    expect(v).toEqual({ business_name: "Green Roots Nursery", tax_identifier: null, city: "Mysuru" });
  });
  it("rejection needs a reason, tells the vendor, and lets them fix and resubmit", async () => {
    await save(bob, { ...PROFILE, business_name: "Bob's Tools", contact_email: "bob@example.com" });
    const bobVendor = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [bob])).id;
    await db.query("delete from public.vendor_document_requirements");
    await submit(bob, ["services"]);
    expect(await failure(db, admin, "select public.admin_review_vendor($1, 'reject', null)", [bobVendor])).toMatch(/reason_required/);
    await review(admin, bobVendor, "reject", "Please add your business address proof");
    expect((await db.query("select 1 from public.notifications where user_id = $1 and kind = 'vendor_reject'", [bob])).rows.length).toBe(1);
    await save(bob, { ...PROFILE, business_name: "Bob's Tools", contact_email: "bob@example.com", description: "Now with details" });
    await submit(bob, ["services"]);
    expect((await one<{ status: string }>("select status from public.vendors where id = $1", [bobVendor])).status).toBe("submitted");
  });
  it("every decision is in the audit log", async () => {
    const actions = (await db.query<{ action: string }>("select action from public.audit_logs where entity_type = 'vendor' order by id")).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["vendor_created", "vendor_submitted", "vendor_approve", "vendor_capability_approve", "vendor_capability_reject", "vendor_suspend", "vendor_reinstate"]));
  });
});

describe("stays capability and existing hosts (D1)", () => {
  it("an existing host is mirrored into an approved vendor without touching their properties or role", async () => {
    await db.query(`insert into public.properties (host_id, slug, name, category_id, description, status, published_at)
      values ($1, 'legacy-stay', 'Legacy Stay', (select id from public.property_categories limit 1), 'A property that existed before vendors, with a long enough description.', 'approved', now())`, [hostUser]);
    const before = await one<{ n: string; role: string }>("select (select count(*) from public.properties where host_id = $1) as n, (select role from public.profiles where id = $1) as role", [hostUser]);
    const id = (await as<{ id: string }>(db, hostUser, "select public.ensure_legacy_vendor() as id"))[0].id;
    expect((await as<{ id: string }>(db, hostUser, "select public.ensure_legacy_vendor() as id"))[0].id).toBe(id); // idempotent
    const v = await one<{ status: string; is_legacy_host: boolean }>("select status, is_legacy_host from public.vendors where id = $1", [id]);
    expect(v).toEqual({ status: "approved", is_legacy_host: true });
    expect(await can(id, "stays")).toBe(true);
    expect(await can(id, "products")).toBe(false);
    const after = await one<{ n: string; role: string }>("select (select count(*) from public.properties where host_id = $1) as n, (select role from public.profiles where id = $1) as role", [hostUser]);
    expect(after).toEqual(before);
    expect(await as(db, hostUser, "select id from public.properties where host_id = $1", [hostUser])).toHaveLength(1); // host workflow unchanged
  });
  it("customers without a vendor and admins cannot use the legacy shortcut", async () => {
    const frank = await createUser(db, "frank@test.dev", { full_name: "Frank" });
    expect(await failure(db, frank, "select public.ensure_legacy_vendor()")).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.ensure_legacy_vendor()")).toMatch(/forbidden/);
  });
  it("approving a new vendor's stays capability makes them a host through the audited route", async () => {
    const dave = await createUser(db, "dave@test.dev", { full_name: "Dave" });
    const id = await save(dave, { ...PROFILE, business_name: "Dave's Farm Stay", contact_email: "dave@example.com" });
    await submit(dave, ["stays"]);
    await review(admin, id, "approve");
    expect((await one<{ role: string }>("select role from public.profiles where id = $1", [dave])).role).toBe("traveller");
    await reviewCap(admin, id, "stays", "approve");
    expect((await one<{ role: string }>("select role from public.profiles where id = $1", [dave])).role).toBe("host");
    expect(await can(id, "stays")).toBe(true);
  });
  it("an approved vendor can ask for another capability, which is approved separately", async () => {
    const hera = await createUser(db, "hera@test.dev", { full_name: "Hera" });
    const id = await save(hera, { ...PROFILE, business_name: "Hera Herbs", contact_email: "hera@example.com" });
    expect(await failure(db, hera, "select public.request_vendor_capability('services')")).toMatch(/vendor_not_approved/);
    await submit(hera, ["products"]);
    await review(admin, id, "approve");
    await reviewCap(admin, id, "products", "approve");
    await as(db, hera, "select public.request_vendor_capability('services')");
    expect(await can(id, "services")).toBe(false);
    expect(await failure(db, hera, "select public.request_vendor_capability('services')")).toMatch(/invalid_status/); // already pending
    expect(await failure(db, hera, "select public.request_vendor_capability('products')")).toMatch(/invalid_status/); // already approved
    await reviewCap(admin, id, "services", "approve");
    expect(await can(id, "services")).toBe(true);
    expect(await failure(db, carol, "select public.request_vendor_capability('stays')")).toMatch(/vendor_not_approved/); // draft vendor
  });
  it("a legacy host can ask for products without re-verification of stays", async () => {
    const id = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [hostUser])).id;
    await as(db, hostUser, "select public.request_vendor_capability('products')");
    expect(await can(id, "stays")).toBe(true);
    expect(await can(id, "products")).toBe(false);
  });
  it("one vendor can hold all three capabilities at once", async () => {
    const erin = await createUser(db, "erin@test.dev", { full_name: "Erin" });
    const id = await save(erin, { ...PROFILE, business_name: "Erin Everything", contact_email: "erin@example.com" });
    await submit(erin, ["products", "services", "stays"]);
    await review(admin, id, "approve");
    for (const cap of ["products", "services", "stays"]) await reviewCap(admin, id, cap, "approve");
    for (const cap of ["products", "services", "stays"]) expect(await can(id, cap)).toBe(true);
  });
});

describe("verification documents", () => {
  let aliceVendor: string;
  let bobVendor: string;
  let docId: string;
  beforeAll(async () => {
    aliceVendor = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [alice])).id;
    bobVendor = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [bob])).id;
  });
  it("document rows can only point at the vendor's own folder", async () => {
    expect(await failure(db, alice, "select public.register_vendor_document(null, 'Steal', $1, 'x.pdf')", [`${bobVendor}/x.pdf`])).toMatch(/forbidden/);
    expect(await failure(db, alice, "select public.register_vendor_document(null, 'Bad', $1, 'x.pdf')", [`../${aliceVendor}/x.pdf`])).toMatch(/forbidden/);
    docId = (await as<{ id: string }>(db, alice, "select public.register_vendor_document(null, 'GST certificate', $1, 'gst.pdf') as id", [`${aliceVendor}/gst.pdf`]))[0].id;
    expect(docId).toBeTruthy();
  });
  it("documents are private to their vendor and the admin", async () => {
    expect(await as(db, alice, "select id from public.vendor_documents where id = $1", [docId])).toHaveLength(1);
    expect(await as(db, bob, "select id from public.vendor_documents where id = $1", [docId])).toHaveLength(0);
    expect(await as(db, carol, "select id from public.vendor_documents")).toHaveLength(0);
    expect(await as(db, admin, "select id from public.vendor_documents where id = $1", [docId])).toHaveLength(1);
    expect(await failure(db, alice, "update public.vendor_documents set status = 'accepted' where id = $1", [docId])).toMatch(/permission denied/);
  });
  it("only an administrator can review a document, a rejection needs a note, and accepted documents cannot be removed", async () => {
    expect(await failure(db, alice, "select public.admin_review_vendor_document($1, 'accept', null)", [docId])).toMatch(/forbidden/);
    expect(await failure(db, admin, "select public.admin_review_vendor_document($1, 'reject', null)", [docId])).toMatch(/reason_required/);
    await as(db, admin, "select public.admin_review_vendor_document($1, 'accept', 'Looks fine')", [docId]);
    expect(await failure(db, alice, "select public.delete_vendor_document($1)", [docId])).toMatch(/invalid_status/);
    expect(await failure(db, bob, "select public.delete_vendor_document($1)", [docId])).toMatch(/not_found/);
    const other = (await as<{ id: string }>(db, alice, "select public.register_vendor_document(null, 'Spare', $1, 's.pdf') as id", [`${aliceVendor}/s.pdf`]))[0].id;
    expect((await as<{ p: string }>(db, alice, "select public.delete_vendor_document($1) as p", [other]))[0].p).toBe(`${aliceVendor}/s.pdf`);
  });
  it("requirements are configurable by administrators only, and readable by signed-in vendors", async () => {
    await db.query("insert into public.vendor_document_requirements (slug, name, capability, category_kind, category_id, is_required) values ('food-licence', 'Food licence', 'products', 'product_category', 3, false)");
    expect((await as(db, alice, "select slug from public.vendor_document_requirements where slug = 'food-licence'")).length).toBe(1);
    expect(await failure(db, alice, "insert into public.vendor_document_requirements (slug, name, capability) values ('x', 'X', 'products')")).toMatch(/row-level security/);
    await as(db, admin, "update public.vendor_document_requirements set is_active = false where slug = 'food-licence'");
    expect((await as(db, alice, "select slug from public.vendor_document_requirements where slug = 'food-licence'")).length).toBe(0);
    expect(await failure(db, admin, "insert into public.vendor_document_requirements (slug, name, capability, category_kind) values ('bad', 'Bad', 'products', 'product_category')")).toMatch(/check constraint/);
    expect((await db.query("select 1 from public.audit_logs where entity_type = 'vendor_document_requirements'")).rows.length).toBeGreaterThan(0);
  });
});

describe("delivery and service coverage by PIN code", () => {
  let aliceVendor: string;
  let bobVendor: string;
  beforeAll(async () => {
    aliceVendor = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [alice])).id;
    bobVendor = (await one<{ id: string }>("select id from public.vendors where owner_id = $1", [bob])).id;
  });
  const covers = async (v: string, scope: string, pin: string) => (await one<{ c: boolean }>("select public.vendor_covers_pin($1,$2,$3) as c", [v, scope, pin])).c;

  it("covers exact PINs and 3-digit prefixes, per scope, and nothing else", async () => {
    expect(await covers(aliceVendor, "delivery", "560078")).toBe(false); // nothing configured: never assume everyone ships everywhere
    expect((await as<{ n: number }>(db, alice, "select public.set_vendor_service_areas('delivery', array['560078', '562', ' 560078 ', '']) as n"))[0].n).toBe(2);
    expect(await covers(aliceVendor, "delivery", "560078")).toBe(true);
    expect(await covers(aliceVendor, "delivery", "562112")).toBe(true); // prefix
    expect(await covers(aliceVendor, "delivery", "560079")).toBe(false);
    expect(await covers(aliceVendor, "service", "560078")).toBe(false); // other scope untouched
    expect(await covers(aliceVendor, "delivery", "56007")).toBe(false); // malformed input
    expect(await covers(bobVendor, "delivery", "560078")).toBe(false); // other vendor
  });
  it("replaces the set, validates codes, and is limited to the caller's own vendor", async () => {
    await as(db, alice, "select public.set_vendor_service_areas('delivery', array['110001'])");
    expect(await covers(aliceVendor, "delivery", "560078")).toBe(false);
    expect(await covers(aliceVendor, "delivery", "110001")).toBe(true);
    expect(await failure(db, alice, "select public.set_vendor_service_areas('delivery', array['12ab56'])")).toMatch(/invalid_pin/);
    expect(await failure(db, alice, "select public.set_vendor_service_areas('everywhere', array['110001'])")).toMatch(/invalid_scope/);
    const gina = await createUser(db, "gina@test.dev", { full_name: "Gina" });
    expect(await failure(db, gina, "select public.set_vendor_service_areas('delivery', array['110001'])")).toMatch(/not_found/);
    expect(await failure(db, alice, "select public.set_vendor_service_areas('delivery', (select array_agg(lpad(g::text, 6, '0')) from generate_series(1, 501) g))")).toMatch(/too_many_areas/);
    expect(await as(db, bob, "select id from public.vendor_service_areas")).toHaveLength(0);
    expect(await failure(db, alice, "insert into public.vendor_service_areas (vendor_id, scope, pin_code) values ($1, 'delivery', '560001')", [aliceVendor])).toMatch(/permission denied/);
  });
});

describe("existing Stays data is untouched", () => {
  it("keeps the account roles and every existing table's policies", async () => {
    expect((await db.query<{ v: string }>("select unnest(enum_range(null::public.app_role))::text as v")).rows.map((r) => r.v)).toEqual(["traveller", "host", "admin"]);
    expect(Number((await one<{ n: string }>("select count(*) as n from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname = 'bookings'")).n)).toBe(1);
    expect(Number((await one<{ n: string }>("select count(*) as n from public.commission_ledger")).n)).toBe(0);
  });
  it("RLS is enabled on every new table", async () => {
    const rows = (await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relname like 'vendor%' and relkind = 'r'")).rows;
    expect(rows.length).toBe(5);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
