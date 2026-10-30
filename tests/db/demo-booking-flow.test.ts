import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { as, createDb, createUser, dayOffset, failure, type Db } from "./harness";

/**
 * The whole marketplace flow on the six demonstration listings, at database level (the same functions the app calls):
 * customer requests -> host sees it -> host accepts/rejects -> customer sees the new status -> conflicts are refused.
 * The demo listings are first assigned to a test host with the documented script, exactly as a tester would.
 */
const ROOT = path.resolve(__dirname, "../..");
let db: Db;
let host: string;
let otherHost: string;
let alice: string;
let bob: string;
let carol: string;
let admin: string;
let farm: string; // Green Valley Farm Stay (max 5 guests)
let cycling: string; // Weekend Cycling Retreat (min 2 nights)

const request = (user: string, property: string, from: number, to: number, adults = 2, children = 0) =>
  as<{ id: string }>(db, user, "select public.request_booking($1,$2,$3,$4,$5,null) as id", [property, dayOffset(from), dayOffset(to), adults, children]);
const statusFor = async (user: string, id: string) => (await as<{ status: string }>(db, user, "select status from public.bookings where id = $1", [id]))[0]?.status;

beforeAll(async () => {
  db = await createDb({ seed: true });
  host = await createUser(db, "test-host@example.test", { account_type: "host", full_name: "Test Host" });
  otherHost = await createUser(db, "other-host@example.test", { account_type: "host" });
  alice = await createUser(db, "alice@example.test", { full_name: "Alice Customer" });
  bob = await createUser(db, "bob@example.test", { full_name: "Bob Customer" });
  carol = await createUser(db, "carol@example.test", { full_name: "Carol Customer" });
  admin = await createUser(db, "admin@example.test");
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
  await db.query("update auth.users set email_confirmed_at = now() where id = $1", [host]);

  // A tester assigns the demo listings to THEIR host account with the documented script.
  const script = fs.readFileSync(path.join(ROOT, "supabase/scripts/assign_demo_listings_to_host.sql"), "utf8");
  await db.exec(script.replace("REPLACE_WITH_YOUR_TEST_HOST_EMAIL@example.com", "test-host@example.test"));
  farm = (await db.query<{ id: string }>("select id from public.properties where slug = 'demo-green-valley-farm-stay'")).rows[0].id;
  cycling = (await db.query<{ id: string }>("select id from public.properties where slug = 'demo-weekend-cycling-retreat'")).rows[0].id;
});

describe("assign_demo_listings_to_host.sql", () => {
  it("gives all six demo listings to the verified test host and audits it", async () => {
    expect((await db.query("select 1 from public.properties where is_sample and host_id = $1", [host])).rows).toHaveLength(6);
    expect((await db.query("select 1 from public.audit_logs where action = 'assign_demo_listings'")).rows).toHaveLength(1);
  });
  it("refuses the placeholder, an unverified account, a traveller, and an unknown e-mail", async () => {
    const script = fs.readFileSync(path.join(ROOT, "supabase/scripts/assign_demo_listings_to_host.sql"), "utf8");
    const run = async (email: string) => { try { await db.exec(script.replace("REPLACE_WITH_YOUR_TEST_HOST_EMAIL@example.com", email)); return null; } catch (e) { return (e as Error).message; } };
    expect(await run("REPLACE_WITH_YOUR_TEST_HOST_EMAIL@example.com")).toMatch(/Edit v_email first/);
    expect(await run("other-host@example.test")).toMatch(/No verified, active HOST/); // not verified
    await db.query("update auth.users set email_confirmed_at = now() where email = 'alice@example.test'");
    expect(await run("alice@example.test")).toMatch(/No verified, active HOST/); // a traveller
    expect(await run("nobody@example.test")).toMatch(/No verified, active HOST/);
  });
});

describe("customer -> host -> customer booking flow on a demo listing", () => {
  let aliceReq: string;
  let bobReq: string;

  it("a customer's request is saved as 'requested' (never confirmed) and notifies the host", async () => {
    aliceReq = (await request(alice, farm, 30, 33, 2, 1))[0].id;
    expect(await statusFor(alice, aliceReq)).toBe("requested");
    const note = await as<{ title: string }>(db, host, "select title from public.notifications where kind = 'booking_requested'");
    expect(note.length).toBeGreaterThanOrEqual(1);
  });

  it("the customer sees it in their bookings; the host sees it; nobody else does", async () => {
    expect(await as(db, alice, "select id from public.bookings")).toHaveLength(1);
    expect((await as<{ id: string }>(db, host, "select id from public.bookings")).map((r) => r.id)).toEqual([aliceReq]);
    expect(await as(db, bob, "select id from public.bookings")).toHaveLength(0);          // another customer
    expect(await as(db, otherHost, "select id from public.bookings")).toHaveLength(0);   // another host
    expect(await failure(db, null, "select id from public.bookings")).toMatch(/permission denied/); // anonymous: no access at all
  });

  it("the price saved with the request is the one the guest was shown", async () => {
    const [row] = await as<{ indicative_total_inr: string; price_breakdown: { nights: number; total: number } }>(db, alice, "select indicative_total_inr, price_breakdown from public.bookings where id = $1", [aliceReq]);
    const shown = (await as<{ q: { total: number } }>(db, null, "select public.quote_stay($1,$2,$3,3) as q", [farm, dayOffset(30), dayOffset(33)]))[0].q.total;
    expect(Number(row.indicative_total_inr)).toBe(shown);
    expect(row.price_breakdown.nights).toBe(3);
  });

  it("a second customer can ALSO request overlapping dates (pending requests may overlap)", async () => {
    bobReq = (await request(bob, farm, 31, 34))[0].id;
    expect(await statusFor(bob, bobReq)).toBe("requested");
  });

  it("only the owning host can accept; customers and other hosts cannot, and customers cannot edit statuses", async () => {
    for (const user of [alice, bob, otherHost, null]) {
      expect(await failure(db, user, "select public.respond_to_booking($1, true, null)", [aliceReq])).toMatch(/forbidden|permission denied|not_authenticated/);
    }
    expect(await failure(db, alice, "update public.bookings set status = 'confirmed' where id = $1", [aliceReq])).toMatch(/permission denied/);
    expect(await statusFor(alice, aliceReq)).toBe("requested");
  });

  it("the host accepts -> both dashboards show 'confirmed' and the customer is notified", async () => {
    await as(db, host, "select public.respond_to_booking($1, true, 'See you soon')", [aliceReq]);
    expect(await statusFor(alice, aliceReq)).toBe("confirmed");
    expect(await statusFor(host, aliceReq)).toBe("confirmed");
    expect((await as<{ title: string }>(db, alice, "select title from public.notifications where kind = 'booking_confirmed'")).length).toBe(1);
  });

  it("an overlapping request can no longer be accepted, and new overlapping requests are refused", async () => {
    expect(await failure(db, host, "select public.respond_to_booking($1, true, null)", [bobReq])).toMatch(/dates_unavailable/);
    expect(await failure(db, carol, "select public.request_booking($1,$2,$3,2,0,null)", [farm, dayOffset(32), dayOffset(35)])).toMatch(/dates_unavailable/);
    expect(await statusFor(bob, bobReq)).toBe("requested");
  });

  it("the host rejects the other request -> the customer sees 'rejected'", async () => {
    await as(db, host, "select public.respond_to_booking($1, false, 'Dates taken')", [bobReq]);
    expect(await statusFor(bob, bobReq)).toBe("rejected");
  });

  it("the customer can cancel their own confirmed booking, which frees the dates", async () => {
    await as(db, alice, "select public.cancel_booking($1, 'Plans changed')", [aliceReq]);
    expect(await statusFor(alice, aliceReq)).toBe("cancelled_by_traveller");
    expect(await statusFor(host, aliceReq)).toBe("cancelled_by_traveller");
    expect((await request(carol, farm, 32, 35))).toHaveLength(1); // free again
  });
});

describe("validation is enforced by the server", () => {
  it("guest capacity (Green Valley sleeps 5)", async () => {
    expect(await failure(db, alice, "select public.request_booking($1,$2,$3,5,1,null)", [farm, dayOffset(60), dayOffset(62)])).toMatch(/invalid_guests/);
    expect((await request(alice, farm, 60, 62, 4, 1))).toHaveLength(1); // exactly 5 is fine
  });
  it("dates: check-out after check-in, not in the past, valid at all", async () => {
    for (const [from, to] of [[70, 70], [72, 70], [-3, 2]]) {
      expect(await failure(db, alice, "select public.request_booking($1,$2,$3,2,0,null)", [farm, dayOffset(from), dayOffset(to)]), `${from}->${to}`).toMatch(/invalid_dates/);
    }
    expect(await failure(db, alice, "select public.request_booking($1,'2026-02-30','2026-03-02',2,0,null)", [farm])).toBeTruthy();
  });
  it("minimum stay (Weekend Cycling Retreat needs 2 nights)", async () => {
    expect(await failure(db, alice, "select public.request_booking($1,$2,$3,2,0,null)", [cycling, dayOffset(80), dayOffset(81)])).toMatch(/invalid_stay_length:2-7/);
  });
  it("repeated clicks cannot create duplicate requests", async () => {
    const first = await request(bob, cycling, 90, 93);
    expect(first).toHaveLength(1);
    expect(await failure(db, bob, "select public.request_booking($1,$2,$3,2,0,null)", [cycling, dayOffset(90), dayOffset(93)])).toMatch(/duplicate_request/);
    expect(await failure(db, bob, "select public.request_booking($1,$2,$3,2,0,null)", [cycling, dayOffset(91), dayOffset(94)])).toMatch(/duplicate_request/); // overlapping own request too
    expect((await as(db, bob, "select id from public.bookings where property_id = $1 and status = 'requested'", [cycling]))).toHaveLength(1);
  });
  it("hosts cannot book their own listing; anonymous visitors cannot book at all", async () => {
    expect(await failure(db, host, "select public.request_booking($1,$2,$3,2,0,null)", [farm, dayOffset(100), dayOffset(102)])).toMatch(/own_property/);
    expect(await failure(db, null, "select public.request_booking($1,$2,$3,2,0,null)", [farm, dayOffset(100), dayOffset(102)])).toMatch(/permission denied|not_authenticated/);
  });
});

describe("overlapping reservations cannot both be confirmed", () => {
  let ids: string[];

  it("many customers may have overlapping pending requests", async () => {
    ids = [];
    for (const user of [alice, bob, carol]) ids.push((await request(user, cycling, 120, 123))[0].id);
    expect(ids).toHaveLength(3);
  });

  it("accepting them all in a burst confirms exactly one; every other attempt is refused", async () => {
    // NOTE: this in-memory database runs one statement at a time, so this checks the RULE (the accept function's lock and
    // check). Truly parallel transactions are covered by the constraint test below and by scripts/concurrency-check.mjs on the live DB.
    const results: string[] = [];
    for (const id of ids) {
      try { await as(db, host, "select public.respond_to_booking($1, true, null)", [id]); results.push("confirmed"); } catch (e) { results.push((e as Error).message.includes("dates_unavailable") ? "refused" : "other-error"); }
    }
    expect(results.filter((r) => r === "confirmed")).toHaveLength(1);
    expect(results.filter((r) => r === "refused")).toHaveLength(2);
    expect((await db.query("select 1 from public.bookings where property_id = $1 and status = 'confirmed' and check_in = $2", [cycling, dayOffset(120)])).rows).toHaveLength(1);
  });

  it("even if two transactions both passed every check, the database constraint refuses the second confirmed booking", async () => {
    // This is what protects a real race: PostgreSQL's exclusion constraint is evaluated at commit on the same index, so two
    // simultaneous confirmations for overlapping dates cannot both succeed, whatever the application code did.
    const insert = (a: number, b: number) => db.query(
      `insert into public.bookings (property_id, traveller_id, check_in, check_out, adults, status, property_name, cancellation_policy)
       values ($1, $2, $3, $4, 1, 'confirmed', 'Race test', 'moderate')`, [farm, carol, dayOffset(a), dayOffset(b)]);
    await insert(200, 204);
    await expect(insert(203, 206)).rejects.toThrow(/bookings_no_confirmed_overlap|conflicting key/);
    await expect(insert(204, 206)).resolves.toBeDefined(); // touching ranges (check-out day = next check-in) are fine
  });
});

describe("authorization boundaries", () => {
  it("a customer cannot reach another customer's booking, host data or admin data", async () => {
    const mine = await as<{ traveller_id: string }>(db, carol, "select traveller_id from public.bookings");
    expect(mine.every((b) => b.traveller_id === carol)).toBe(true);
    expect(await as(db, carol, "select * from public.property_private")).toHaveLength(0);
    expect(await as(db, carol, "select * from public.audit_logs")).toHaveLength(0);
    expect(await failure(db, carol, "select public.review_property($1, 'approve', null)", [farm])).toMatch(/forbidden/);
    expect(await failure(db, carol, "select public.admin_update_user($1, 'host')", [alice])).toMatch(/forbidden/);
  });
  it("a host cannot approve their own listing, see another host's bookings or change a listing's status", async () => {
    expect(await failure(db, host, "select public.review_property($1, 'approve', null)", [farm])).toMatch(/forbidden/);
    expect(await failure(db, host, "update public.properties set status = 'suspended' where id = $1", [farm])).toMatch(/forbidden_status_change/);
    expect(await as(db, otherHost, "select id from public.bookings")).toHaveLength(0);
    const someBooking = (await db.query<{ id: string }>("select id from public.bookings where status = 'requested' limit 1")).rows[0].id;
    expect(await failure(db, otherHost, "select public.respond_to_booking($1, true, null)", [someBooking])).toMatch(/forbidden/);
  });
  it("an administrator can oversee the booking (platform operator role)", async () => {
    expect((await as(db, admin, "select id from public.bookings")).length).toBeGreaterThan(0);
  });
});
