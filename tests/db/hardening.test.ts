import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, dayOffset, failure, insertApprovedProperty, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;
let host: string;
let guest: string;
let prop: string;

beforeAll(async () => {
  db = await createDb({ seed: true });
  admin = await makeAdmin(db, "admin@example.test");
  host = await createUser(db, "host@example.test", { account_type: "host" });
  guest = await createUser(db, "guest@example.test", { full_name: "Guest" });
  prop = await insertApprovedProperty(db, host);
});

/** Runs as the server-side service role (the only caller allowed to use the rate limiter). */
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const hit = (bucket: string, limit: number, window: number) =>
  asService(async () => (await db.query<{ rate_limit_hit: boolean }>("select public.rate_limit_hit($1,$2,$3)", [bucket, limit, window])).rows[0].rate_limit_hit);

describe("rate limiting", () => {
  it("allows up to the limit inside the window, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hit("contact:1.2.3.4", 3, 600));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("buckets are independent", async () => {
    for (let i = 0; i < 4; i++) await hit("contact:5.5.5.5", 3, 600);
    expect(await hit("contact:6.6.6.6", 3, 600)).toBe(true);
  });

  it("starts a fresh window once the old one has expired", async () => {
    for (let i = 0; i < 4; i++) await hit("enquiry:expiring", 2, 600);
    expect(await hit("enquiry:expiring", 2, 600)).toBe(false);
    await db.query("update public.rate_limits set window_start = now() - interval '2 hours' where bucket = 'enquiry:expiring'");
    expect(await hit("enquiry:expiring", 2, 600)).toBe(true);
  });

  it("rejects nonsense parameters", async () => {
    await expect(hit("x", 0, 60)).rejects.toThrow(/invalid_rate_limit/);
    await expect(hit("x".repeat(201), 5, 60)).rejects.toThrow(/invalid_rate_limit/);
  });

  it("browsers (anon / signed-in users) can neither call the limiter nor read or write its table", async () => {
    for (const user of [null, guest, admin]) {
      expect(await failure(db, user, "select public.rate_limit_hit('contact:victim', 1, 60)")).toMatch(/permission denied/);
      expect(await failure(db, user, "select * from public.rate_limits")).toMatch(/permission denied/);
      expect(await failure(db, user, "delete from public.rate_limits")).toMatch(/permission denied/);
    }
  });
});

describe("review moderation", () => {
  let review: string;

  beforeAll(async () => {
    const booking = (await db.query<{ id: string }>(
      `insert into public.bookings (property_id, traveller_id, check_in, check_out, adults, status, property_name, cancellation_policy)
       values ($1, $2, $3, $4, 2, 'confirmed', 'Test Cottage', 'moderate') returning id`,
      [prop, guest, dayOffset(-10), dayOffset(-8)])).rows[0].id;
    review = (await as<{ id: string }>(db, guest,
      "insert into public.reviews (booking_id, property_id, traveller_id, rating, comment) values ($1,$2,$3,2,'Not for me') returning id",
      [booking, prop, guest]))[0].id;
  });

  it("admins can hide and restore a review, and both decisions are audited", async () => {
    await as(db, admin, "select public.moderate_review($1, true, 'abusive language')", [review]);
    expect(await as(db, null, "select id from public.reviews where id = $1", [review])).toHaveLength(0);
    await as(db, admin, "select public.moderate_review($1, false, null)", [review]);
    expect(await as(db, null, "select id from public.reviews where id = $1", [review])).toHaveLength(1);
    const audit = await as<{ action: string }>(db, admin, "select action from public.audit_logs where entity_id = $1 order by id", [review]);
    expect(audit.map((a) => a.action)).toEqual(["review_hide", "review_restore"]);
  });

  it("nobody else can moderate, and nobody (admins included) can rewrite a review", async () => {
    for (const user of [guest, host, null]) {
      expect(await failure(db, user, "select public.moderate_review($1, true, null)", [review])).toMatch(/forbidden|permission denied/);
    }
    expect(await failure(db, admin, "update public.reviews set rating = 5 where id = $1", [review])).toMatch(/permission denied/);
    expect(await failure(db, guest, "update public.reviews set is_hidden = true where id = $1", [review])).toMatch(/permission denied/);
  });

  it("an unknown review id is reported, not silently ignored", async () => {
    expect(await failure(db, admin, "select public.moderate_review(gen_random_uuid(), true, null)")).toMatch(/not_found/);
  });
});

describe("audit trail for admin changes", () => {
  const actions = async (entity: string) =>
    (await as<{ action: string; details: { columns?: string[] } }>(db, admin, "select action, details from public.audit_logs where entity_id = $1 order by id", [entity]));

  it("records settings changes by column name, never by value", async () => {
    await as(db, admin, "update public.platform_settings set value = '\"919000000088\"'::jsonb where key = 'whatsapp_number'");
    const rows = await actions("whatsapp_number");
    expect(rows.map((r) => r.action)).toContain("update_platform_settings");
    expect(JSON.stringify(rows)).not.toContain("919000000088");
    expect(rows[0].details.columns).toEqual(["value"]);
  });

  it("records featuring a listing, catalogue changes and enquiry triage", async () => {
    await as(db, admin, "update public.properties set is_featured = true where id = $1", [prop]);
    expect((await actions(prop)).map((r) => r.action)).toContain("update_properties");

    const cat = (await as<{ id: string }>(db, admin, "insert into public.experiences (slug, name) values ('night-trek', 'Night trek') returning id::text as id"))[0].id;
    await as(db, admin, "update public.experiences set is_active = false where id = $1::bigint", [cat]);
    expect((await actions(cat)).map((r) => r.action)).toEqual(["insert_experiences", "update_experiences"]);

    const enquiry = (await db.query<{ id: string }>(
      "insert into public.contact_enquiries (name, email, message) values ('Visitor', 'v@example.test', 'Hello there, please call') returning id")).rows[0].id;
    await as(db, admin, "update public.contact_enquiries set status = 'resolved', admin_notes = 'called back' where id = $1", [enquiry]);
    const triage = await actions(enquiry);
    expect(triage.map((r) => r.action)).toEqual(["update_contact_enquiries"]);
    expect(triage[0].details.columns).toEqual(["admin_notes", "status"]);
  });

  it("ignores edits by non-admins and by the database owner, and never double-logs unchanged rows", async () => {
    const before = (await as(db, admin, "select id from public.audit_logs")).length;
    await db.query("update public.platform_settings set description = 'owner edit' where key = 'support_email'"); // no auth.uid()
    await as(db, host, "update public.properties set description = description || ' ' where id = $1", [prop]);
    await as(db, admin, "update public.platform_settings set value = value where key = 'support_email'"); // nothing changed
    expect((await as(db, admin, "select id from public.audit_logs")).length).toBe(before);
  });

  it("the audit helper itself is not callable from the API", async () => {
    expect(await failure(db, admin, "select public.audit_admin_change()")).toMatch(/permission denied/);
  });
});
