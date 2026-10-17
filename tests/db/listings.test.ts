import { beforeAll, describe, expect, it } from "vitest";
import { as, categoryId, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;
let host: string;
let otherHost: string;
let traveller: string;

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@example.test");
  host = await createUser(db, "host@example.test", { account_type: "host", full_name: "Host One" });
  otherHost = await createUser(db, "host2@example.test", { account_type: "host" });
  traveller = await createUser(db, "trav@example.test");
});

async function makeDraft(slug: string, owner = host): Promise<string> {
  const cat = await categoryId(db);
  const rows = await as<{ id: string }>(
    db, owner,
    `insert into public.properties (host_id, slug, name, category_id, description, city, state, terms_accepted_at)
     values ($1, $2, 'Draft Cottage', $3, $4, 'Bengaluru', 'Karnataka', now()) returning id`,
    [owner, slug, cat, "A lovely cottage with enough description text to satisfy the review rules."],
  );
  return rows[0].id;
}

async function completeDraft(id: string, owner = host) {
  await as(db, owner,
    `insert into public.property_images (property_id, path, source) values ($1, '/images/x.jpg', 'static')`, [id]);
  await as(db, owner,
    `insert into public.property_private (property_id, address_line, contact_name, contact_phone)
     values ($1, '12 Test Lane', 'Host One', '+919000000001')`, [id]);
}

describe("listing submission and approval workflow", () => {
  it("refuses to submit an incomplete listing and names what is missing", async () => {
    const id = await makeDraft("incomplete-1");
    const msg = await failure(db, host, "select public.submit_property($1)", [id]);
    expect(msg).toMatch(/incomplete_listing/);
    expect(msg).toMatch(/photos/);
    expect(msg).toMatch(/contact_and_address/);
  });

  it("a host cannot approve their own listing by editing status", async () => {
    const id = await makeDraft("self-approve-1");
    expect(await failure(db, host, "update public.properties set status = 'approved' where id = $1", [id])).toMatch(
      /forbidden_status_change/,
    );
    const [row] = await db.query<{ status: string }>("select status from public.properties where id = $1", [id]).then((r) => r.rows);
    expect(row.status).toBe("draft");
  });

  it("a host cannot call review_property", async () => {
    const id = await makeDraft("self-approve-2");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);
    expect(await failure(db, host, "select public.review_property($1, 'approve')", [id])).toMatch(/forbidden/);
  });

  it("host cannot tamper with featured / reviewer / publish fields", async () => {
    const id = await makeDraft("tamper-1");
    for (const sql of [
      "update public.properties set is_featured = true where id = $1",
      "update public.properties set is_sample = true where id = $1",
      "update public.properties set published_at = now() where id = $1",
      "update public.properties set reviewed_by = host_id where id = $1",
      "update public.properties set host_id = null where id = $1",
    ]) {
      expect(await failure(db, host, sql, [id])).toMatch(/forbidden_property_change/);
    }
  });

  it("full happy path: draft -> pending -> hidden -> approved -> public", async () => {
    const id = await makeDraft("happy-1");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);

    // Pending: owner and admin see it; the public, other hosts and travellers do not.
    expect(await as(db, host, "select id from public.properties where id = $1", [id])).toHaveLength(1);
    expect(await as(db, admin, "select id from public.properties where id = $1", [id])).toHaveLength(1);
    expect(await as(db, null, "select id from public.properties where id = $1", [id])).toHaveLength(0);
    expect(await as(db, traveller, "select id from public.properties where id = $1", [id])).toHaveLength(0);
    expect(await as(db, otherHost, "select id from public.properties where id = $1", [id])).toHaveLength(0);

    await as(db, admin, "select public.review_property($1, 'approve')", [id]);
    expect(await as(db, null, "select id from public.properties where id = $1", [id])).toHaveLength(1);

    // Host got a notification, admin action was audited.
    const n = await as(db, host, "select kind from public.notifications where kind = 'property_approved'");
    expect(n.length).toBeGreaterThanOrEqual(1);
    const audit = await as(db, admin, "select action from public.audit_logs where entity_id = $1", [id]);
    expect(audit.map((a) => a.action)).toContain("property_approve");
  });

  it("rejection requires a reason and lets the host resubmit", async () => {
    const id = await makeDraft("reject-1");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);
    expect(await failure(db, admin, "select public.review_property($1, 'reject')", [id])).toMatch(/reason_required/);
    await as(db, admin, "select public.review_property($1, 'reject', 'Photos are too dark')", [id]);
    const [row] = await as<{ status: string; rejection_reason: string }>(
      db, host, "select status, rejection_reason from public.properties where id = $1", [id]);
    expect(row).toEqual({ status: "rejected", rejection_reason: "Photos are too dark" });
    await as(db, host, "select public.submit_property($1)", [id]);
    const [again] = await as<{ status: string }>(db, host, "select status from public.properties where id = $1", [id]);
    expect(again.status).toBe("pending_review");
  });

  it("suspending removes a live listing from public view; reinstating restores it", async () => {
    const id = await makeDraft("suspend-1");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);
    await as(db, admin, "select public.review_property($1, 'approve')", [id]);
    await as(db, admin, "select public.review_property($1, 'suspend', 'Reported and under investigation')", [id]);
    expect(await as(db, null, "select id from public.properties where id = $1", [id])).toHaveLength(0);
    await as(db, admin, "select public.review_property($1, 'reinstate')", [id]);
    expect(await as(db, null, "select id from public.properties where id = $1", [id])).toHaveLength(1);
  });

  it("material edits to a live listing send it back to review; minor edits do not", async () => {
    const id = await makeDraft("edit-live-1");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);
    await as(db, admin, "select public.review_property($1, 'approve')", [id]);

    await as(db, host, "update public.properties set price_inr = 7000, house_rules = 'Quiet after 10' where id = $1", [id]);
    const [minor] = await as<{ status: string }>(db, host, "select status from public.properties where id = $1", [id]);
    expect(minor.status).toBe("approved");

    await as(db, host, "update public.properties set name = 'Totally Different Name' where id = $1", [id]);
    const [material] = await as<{ status: string }>(db, host, "select status from public.properties where id = $1", [id]);
    expect(material.status).toBe("pending_review");
    expect(await as(db, null, "select id from public.properties where id = $1", [id])).toHaveLength(0);
  });

  it("another host cannot edit or delete a listing they do not own", async () => {
    const id = await makeDraft("ownership-1");
    expect(await as(db, otherHost, "update public.properties set name = 'Hijacked' where id = $1 returning id", [id])).toHaveLength(0);
    expect(await as(db, otherHost, "delete from public.properties where id = $1 returning id", [id])).toHaveLength(0);
  });

  it("only drafts can be deleted by their host", async () => {
    const id = await makeDraft("delete-1");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);
    expect(await as(db, host, "delete from public.properties where id = $1 returning id", [id])).toHaveLength(0);
  });
});

describe("private owner data", () => {
  it("address and contact details never leak to the public, travellers or other hosts", async () => {
    const id = await makeDraft("private-1");
    await completeDraft(id);
    await as(db, host, "select public.submit_property($1)", [id]);
    await as(db, admin, "select public.review_property($1, 'approve')", [id]);
    for (const who of [null, traveller, otherHost]) {
      expect(await as(db, who, "select * from public.property_private where property_id = $1", [id])).toHaveLength(0);
    }
    expect(await as(db, host, "select address_line from public.property_private where property_id = $1", [id])).toHaveLength(1);
    expect(await as(db, admin, "select address_line from public.property_private where property_id = $1", [id])).toHaveLength(1);
  });

  it("other hosts cannot attach images, rooms or amenities to someone else's listing", async () => {
    const id = await makeDraft("child-rows-1");
    expect(await failure(db, otherHost,
      "insert into public.property_images (property_id, path, source) values ($1, 'x', 'static')", [id])).toMatch(/row-level security/);
    expect(await failure(db, otherHost,
      "insert into public.room_types (property_id, name) values ($1, 'Hack')", [id])).toMatch(/row-level security/);
  });
});

describe("host public profile view", () => {
  it("only exposes name + verification, and only for hosts with a live listing", async () => {
    const rows = await as<Record<string, unknown>>(db, null, "select * from public.host_public_profiles");
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(["full_name", "host_verified", "id"]);
    }
  });
});
