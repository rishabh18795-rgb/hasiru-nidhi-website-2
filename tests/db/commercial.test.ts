import { beforeAll, describe, expect, it } from "vitest";

import { as, categoryId, createDb, createUser, dayOffset, failure, makeAdmin, type Db } from "./harness";

/**
 * PIN-code search, the 20 % commission engine and its ledger, payments / refunds, settlements and the complete
 * host -> admin -> customer flow from the PRD, at database level (the same functions the application calls).
 */
let db: Db;
let admin: string;
let host: string;
let otherHost: string;
let alice: string;
let bob: string;

const PIN = "562112";

async function setting(key: string, value: unknown) {
  await db.query("update public.platform_settings set value = $2::jsonb where key = $1", [key, JSON.stringify(value)]);
}

/** An approved listing priced at exactly 10,000 a night (no weekend rate, fees or tax) so the arithmetic is obvious. */
async function approvedListing(owner: string, over: Partial<{ slug: string; pin: string | null; price: number; cleaning: number | null; extraFee: number | null; included: number | null; status: string }> = {}): Promise<string> {
  const slug = over.slug ?? `c-${Math.random().toString(36).slice(2, 9)}`;
  const res = await db.query<{ id: string }>(
    `insert into public.properties (host_id, slug, name, category_id, description, city, state, postal_code, max_guests, price_inr, status, published_at,
                                    cleaning_fee_inr, extra_guest_fee_inr, included_guests)
     values ($1, $2, 'Commission Cottage', $3, 'A commission test property with a description longer than fifty characters.', 'Harohalli', 'Karnataka',
             $4, 8, $5, $6, now(), $7, $8, $9) returning id`,
    [owner, slug, await categoryId(db), over.pin === undefined ? PIN : over.pin, over.price ?? 10000, over.status ?? "approved", over.cleaning ?? null, over.extraFee ?? null, over.included ?? null],
  );
  return res.rows[0].id;
}

const request = (user: string, property: string, from: number, to: number, adults = 2) =>
  as<{ id: string }>(db, user, "select public.request_booking($1,$2,$3,$4,0,null) as id", [property, dayOffset(from), dayOffset(to), adults]).then((r) => r[0].id);
const accept = (user: string, booking: string) => as(db, user, "select public.respond_to_booking($1, true, null)", [booking]);
const row = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const search = (user: string | null, pin: string | null, q: string | null = null) =>
  as<{ id: string; postal_code: string }>(db, user, "select id, postal_code from public.search_properties(p_query => $1, p_pin => $2)", [q, pin]);

/** A confirmed booking whose stay has already finished (past dates cannot be requested, so it is inserted as the owner would be). */
async function pastCompletedBooking(property: string, traveller: string, status = "completed"): Promise<string> {
  const breakdown = { base: 10000, extra_guests: 0, cleaning: 0, total: 10000 };
  const { id } = await row<{ id: string }>(
    `insert into public.bookings (property_id, traveller_id, check_in, check_out, adults, status, property_name, cancellation_policy, guest_name, indicative_total_inr, price_breakdown,
        commission_rate_percent, commission_basis, commissionable_amount_inr, commission_amount_inr, host_share_inr)
     values ($1, $2, $3, $4, 2, $5, 'Commission Cottage', 'moderate', 'Guest', 10000, $6::jsonb, 20, 'accommodation', 10000, 2000, 8000) returning id`,
    [property, traveller, dayOffset(-10), dayOffset(-8), status, JSON.stringify(breakdown)],
  );
  await db.query("select public.ledger_accrue($1)", [id]);
  return id;
}

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@example.test");
  host = await createUser(db, "host@example.test", { account_type: "host", full_name: "Host One" });
  otherHost = await createUser(db, "host2@example.test", { account_type: "host", full_name: "Host Two" });
  alice = await createUser(db, "alice@example.test", { full_name: "Alice" });
  bob = await createUser(db, "bob@example.test", { full_name: "Bob" });
});

describe("PIN-code search", () => {
  it("an exact PIN finds the approved property; an unrelated PIN finds nothing", async () => {
    const id = await approvedListing(host, { pin: "560001" });
    expect((await search(null, "560001")).map((r) => r.id)).toContain(id);
    expect(await search(null, "110001")).toEqual([]);
  });

  it("typing a six-digit PIN into the location box works the same way", async () => {
    const id = await approvedListing(host, { pin: "560002" });
    expect((await search(null, null, "560002")).map((r) => r.id)).toEqual([id]);
  });

  it("returns only approved listings: draft, pending, rejected and suspended never appear, even for an exact PIN", async () => {
    const pin = "560003";
    const ids: string[] = [];
    for (const status of ["draft", "pending_review", "rejected", "suspended"]) ids.push(await approvedListing(host, { pin, status }));
    const live = await approvedListing(host, { pin });
    expect((await search(null, pin)).map((r) => r.id)).toEqual([live]);
    for (const user of [null, alice, host]) expect((await search(user, pin)).some((r) => ids.includes(r.id))).toBe(false);
  });

  it("the PIN is returned with each result and a partial PIN does not match", async () => {
    await approvedListing(host, { pin: "560004" });
    expect((await search(null, "560004"))[0].postal_code).toBe("560004");
    expect(await search(null, "56000")).toEqual([]);
  });
});

describe("PIN code is required to submit an Indian listing", () => {
  async function draft(pin: string | null) {
    const id = (await row<{ id: string }>(
      `insert into public.properties (host_id, slug, name, category_id, description, city, state, postal_code, terms_accepted_at, photo_rights_confirmed_at)
       values ($1, $2, 'Draft Cottage', $3, 'A lovely cottage with enough description text to satisfy the review rules.', 'Mysuru', 'Karnataka', $4, now(), now()) returning id`,
      [host, `d-${Math.random().toString(36).slice(2, 9)}`, await categoryId(db), pin],
    )).id;
    await db.query("insert into public.property_images (property_id, path, source) values ($1, '/images/x.jpg', 'static')", [id]);
    await db.query("insert into public.property_private (property_id, address_line, contact_name, contact_phone) values ($1, '1 Lane', 'Host', '+919000000001')", [id]);
    return id;
  }
  it("refuses a missing or malformed PIN and accepts six digits", async () => {
    expect(await failure(db, host, "select public.submit_property($1)", [await draft(null)])).toMatch(/incomplete_listing.*pin_code/);
    expect(await failure(db, host, "select public.submit_property($1)", [await draft("5600")])).toMatch(/pin_code/);
    expect(await failure(db, host, "select public.submit_property($1)", [await draft("56A001")])).toMatch(/pin_code/);
    const ok = await draft("570001");
    await as(db, host, "select public.submit_property($1)", [ok]);
    expect((await row<{ status: string }>("select status from public.properties where id = $1", [ok])).status).toBe("pending_review");
  });
});

describe("20 % commission engine", () => {
  it("stores the snapshot on the booking: 10,000 -> 2,000 commission + 8,000 host share", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 40, 41);
    const b = await row<Record<string, string>>("select * from public.bookings where id = $1", [id]);
    expect(Number(b.indicative_total_inr)).toBe(10000);
    expect(Number(b.commission_rate_percent)).toBe(20);
    expect(b.commission_basis).toBe("accommodation");
    expect(Number(b.commissionable_amount_inr)).toBe(10000);
    expect(Number(b.commission_amount_inr)).toBe(2000);
    expect(Number(b.host_share_inr)).toBe(8000);
  });

  it("commission + host share always equals the commissionable base, to the paisa", async () => {
    await setting("commission_rate_percent", 17.5);
    const p = await approvedListing(host, { price: 3333.33 });
    const id = await request(alice, p, 50, 51);
    const b = await row<Record<string, string>>("select commissionable_amount_inr c, commission_amount_inr m, host_share_inr h from public.bookings where id = $1", [id]);
    expect(Number(b.m) + Number(b.h)).toBeCloseTo(Number(b.c), 2);
    await setting("commission_rate_percent", 20);
  });

  it("extra-guest charges are commissionable; the cleaning fee only when the policy says so; tax never is", async () => {
    const p = await approvedListing(host, { cleaning: 1000, extraFee: 500, included: 2 });
    await db.query("update public.properties set tax_percent = 12 where id = $1", [p]);
    const id = await request(alice, p, 60, 62, 4); // 2 nights x 10,000 + 2 extra guests x 500 x 2 nights = 22,000 ; + 1,000 cleaning ; + tax
    let b = await row<Record<string, string>>("select * from public.bookings where id = $1", [id]);
    expect(Number(b.commissionable_amount_inr)).toBe(22000);
    expect(Number(b.commission_amount_inr)).toBe(4400);
    expect(Number(b.indicative_total_inr)).toBeCloseTo((22000 + 1000) * 1.12, 2);
    await as(db, admin, "select public.admin_set_commission(20, 'accommodation_and_cleaning', true, true, true)");
    const id2 = await request(bob, p, 60, 62, 4);
    b = await row<Record<string, string>>("select * from public.bookings where id = $1", [id2]);
    expect(Number(b.commissionable_amount_inr)).toBe(23000);
    expect(Number(b.commission_amount_inr)).toBe(4600);
    await as(db, admin, "select public.admin_set_commission(20, 'accommodation', true, true, true)");
  });

  it("changing the rate affects new bookings only; an existing snapshot can never be rewritten", async () => {
    const p = await approvedListing(host);
    const before = await request(alice, p, 70, 71);
    await as(db, admin, "select public.admin_set_commission(25, 'accommodation', true, true, true)");
    const after = await request(bob, p, 72, 73);
    const rate = async (id: string) => Number((await row<{ r: string }>("select commission_rate_percent r from public.bookings where id = $1", [id])).r);
    expect(await rate(before)).toBe(20);
    expect(await rate(after)).toBe(25);
    expect(Number((await row<{ m: string }>("select commission_amount_inr m from public.bookings where id = $1", [after])).m)).toBe(2500);
    // not even the database owner can rewrite history
    await expect(db.query("update public.bookings set commission_amount_inr = 1, host_share_inr = 9999 where id = $1", [before])).rejects.toThrow(/commission_snapshot_immutable/);
    await as(db, admin, "select public.admin_set_commission(20, 'accommodation', true, true, true)");
  });

  it("only an administrator can change the commission, and only to sane values; the change is audited with old and new", async () => {
    expect(await failure(db, host, "select public.admin_set_commission(0, 'accommodation', true, true, true)")).toMatch(/forbidden/);
    expect(await failure(db, alice, "select public.admin_set_commission(0, 'accommodation', true, true, true)")).toMatch(/forbidden/);
    expect(await failure(db, null, "select public.admin_set_commission(0, 'accommodation', true, true, true)")).toMatch(/permission denied|forbidden/);
    expect(await failure(db, admin, "select public.admin_set_commission(60, 'accommodation', true, true, true)")).toMatch(/invalid_setting/);
    expect(await failure(db, admin, "select public.admin_set_commission(20, 'gross', true, true, true)")).toMatch(/invalid_setting/);
    await as(db, admin, "select public.admin_set_commission(22, 'accommodation', true, true, true)");
    const log = await row<{ details: { old: Record<string, unknown>; new: Record<string, unknown> } }>(
      "select details from public.audit_logs where action = 'commission_settings_changed' order by id desc limit 1");
    expect(log.details.new.commission_rate_percent).toBe(22);
    expect(log.details.old.commission_rate_percent).toBe(20);
    await as(db, admin, "select public.admin_set_commission(20, 'accommodation', true, true, true)");
  });

  it("clients cannot write the commission settings directly with bad values, even as admin", async () => {
    await expect(db.query("update public.platform_settings set value = '99'::jsonb where key = 'commission_rate_percent'")).rejects.toThrow(/invalid_setting/);
  });
});

describe("commission ledger", () => {
  it("accepting a booking accrues the commission once; the ledger is append-only", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 80, 81);
    expect((await as(db, admin, "select * from public.commission_ledger where booking_id = $1", [id])).length).toBe(0);
    await accept(host, id);
    const entries = await as<{ kind: string; commission_inr: string; host_share_inr: string }>(db, admin, "select * from public.commission_ledger where booking_id = $1", [id]);
    expect(entries.map((e) => e.kind)).toEqual(["accrual"]);
    expect(Number(entries[0].commission_inr)).toBe(2000);
    expect(Number(entries[0].host_share_inr)).toBe(8000);
    await db.query("select public.ledger_accrue($1)", [id]); // idempotent
    expect((await as(db, admin, "select 1 from public.commission_ledger where booking_id = $1", [id])).length).toBe(1);
    await expect(db.query("update public.commission_ledger set commission_inr = 0 where booking_id = $1", [id])).rejects.toThrow(/ledger_is_append_only/);
    await expect(db.query("delete from public.commission_ledger where booking_id = $1", [id])).rejects.toThrow(/ledger_is_append_only/);
    for (const user of [host, alice, admin]) {
      expect(await failure(db, user, "update public.commission_ledger set commission_inr = 0 where booking_id = $1", [id])).toMatch(/permission denied/);
      expect(await failure(db, user, "insert into public.commission_ledger (booking_id, kind, commissionable_inr, commission_rate_percent, commission_inr, host_share_inr) values ($1,'accrual',1,1,1,1)", [id])).toMatch(/permission denied/);
    }
  });

  it("a rejected or merely requested booking creates no ledger entry", async () => {
    const p = await approvedListing(host);
    const rejected = await request(alice, p, 85, 86);
    await as(db, host, "select public.respond_to_booking($1, false, 'No')", [rejected]);
    const pending = await request(bob, p, 87, 88);
    expect((await as(db, admin, "select 1 from public.commission_ledger where booking_id = any($1::uuid[])", [[rejected, pending]])).length).toBe(0);
  });

  it("cancelling a confirmed booking reverses the commission to zero; cancelling a request does not touch the ledger", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 90, 91);
    await accept(host, id);
    await as(db, alice, "select public.cancel_booking($1, 'plans changed')", [id]);
    const sum = await row<{ c: string; h: string }>("select sum(commission_inr) c, sum(host_share_inr) h from public.commission_ledger where booking_id = $1", [id]);
    expect(Number(sum.c)).toBe(0);
    expect(Number(sum.h)).toBe(0);
    const req = await request(bob, p, 92, 93);
    await as(db, bob, "select public.cancel_booking($1, null)", [req]);
    expect((await as(db, admin, "select 1 from public.commission_ledger where booking_id = $1", [req])).length).toBe(0);
  });

  it("the commission is not reversed on cancellation when the policy says not to", async () => {
    await setting("commission_reverse_on_cancellation", false);
    const p = await approvedListing(host);
    const id = await request(alice, p, 95, 96);
    await accept(host, id);
    await as(db, host, "select public.cancel_booking($1, null)", [id]);
    expect(Number((await row<{ c: string }>("select sum(commission_inr) c from public.commission_ledger where booking_id = $1", [id])).c)).toBe(2000);
    await setting("commission_reverse_on_cancellation", true);
  });

  it("a host sees only their own ledger; other hosts and customers see none; admins see all", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 100, 101);
    await accept(host, id);
    expect((await as(db, host, "select 1 from public.commission_ledger where booking_id = $1", [id])).length).toBe(1);
    expect((await as(db, admin, "select 1 from public.commission_ledger where booking_id = $1", [id])).length).toBe(1);
    expect(await as(db, otherHost, "select 1 from public.commission_ledger where booking_id = $1", [id])).toEqual([]);
    expect(await as(db, alice, "select 1 from public.commission_ledger")).toEqual([]);
    expect(await as(db, null, "select 1 from public.commission_ledger").catch(() => [])).toEqual([]);
  });
});

describe("payments and refunds (administrator-recorded; no gateway is integrated)", () => {
  it("only an admin records a payment, only for a confirmed or completed booking, and the same reference is one payment", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 110, 111);
    expect(await failure(db, admin, "select public.admin_record_payment($1, 5000, 'UTR1')", [id])).toMatch(/invalid_status/);
    await accept(host, id);
    for (const user of [host, alice, otherHost]) expect(await failure(db, user, "select public.admin_record_payment($1, 5000, 'UTR1')", [id])).toMatch(/forbidden/);
    const first = (await as<{ admin_record_payment: string }>(db, admin, "select public.admin_record_payment($1, 6000, 'UTR1', 'bank transfer')", [id]))[0].admin_record_payment;
    const again = (await as<{ admin_record_payment: string }>(db, admin, "select public.admin_record_payment($1, 6000, 'UTR1')", [id]))[0].admin_record_payment;
    expect(again).toBe(first);
    expect(Number((await row<{ n: string }>("select count(*) n from public.payments where booking_id = $1", [id])).n)).toBe(1);
    expect((await row<{ s: string }>("select public.booking_payment_status($1) s", [id])).s).toBe("paid");
  });

  it("refuses an overpayment and invalid input", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 112, 113);
    await accept(host, id);
    await as(db, admin, "select public.admin_record_payment($1, 7000, 'A')", [id]);
    expect(await failure(db, admin, "select public.admin_record_payment($1, 3001, 'B')", [id])).toMatch(/overpayment/);
    expect(await failure(db, admin, "select public.admin_record_payment($1, 0, 'C')", [id])).toMatch(/invalid_payment/);
    expect(await failure(db, admin, "select public.admin_record_payment($1, 100, '  ')", [id])).toMatch(/invalid_payment/);
  });

  it("only the traveller, the owning host and admins can see a payment", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 114, 115);
    await accept(host, id);
    await as(db, admin, "select public.admin_record_payment($1, 10000, 'V1')", [id]);
    for (const user of [alice, host, admin]) expect((await as(db, user, "select 1 from public.payments where booking_id = $1", [id])).length).toBe(1);
    for (const user of [bob, otherHost]) expect(await as(db, user, "select 1 from public.payments where booking_id = $1", [id])).toEqual([]);
  });

  it("a partial refund reverses commission in proportion; a full refund reverses all of it; refunds cannot exceed the payment", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 116, 117);
    await accept(host, id);
    const pay = (await as<{ admin_record_payment: string }>(db, admin, "select public.admin_record_payment($1, 10000, 'R1')", [id]))[0].admin_record_payment;
    expect(await failure(db, admin, "select public.admin_record_refund($1, 2500, '')", [pay])).toMatch(/reason_required/);
    expect(await failure(db, host, "select public.admin_record_refund($1, 2500, 'x')", [pay])).toMatch(/forbidden/);
    await as(db, admin, "select public.admin_record_refund($1, 2500, 'guest goodwill')", [pay]);
    expect((await row<{ s: string }>("select public.booking_payment_status($1) s", [id])).s).toBe("partially_refunded");
    expect(Number((await row<{ c: string }>("select sum(commission_inr) c from public.commission_ledger where booking_id = $1", [id])).c)).toBe(1500); // 2,000 - 25 %
    expect(await failure(db, admin, "select public.admin_record_refund($1, 7501, 'too much')", [pay])).toMatch(/invalid_refund_amount/);
    await as(db, admin, "select public.admin_record_refund($1, 7500, 'rest')", [pay]);
    expect((await row<{ s: string }>("select public.booking_payment_status($1) s", [id])).s).toBe("refunded");
    const sum = await row<{ c: string; h: string }>("select sum(commission_inr) c, sum(host_share_inr) h from public.commission_ledger where booking_id = $1", [id]);
    expect(Number(sum.c)).toBe(0);
    expect(Number(sum.h)).toBe(0);
  });

  it("a refund after a cancellation cannot reverse more commission than is outstanding", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 118, 119);
    await accept(host, id);
    const pay = (await as<{ admin_record_payment: string }>(db, admin, "select public.admin_record_payment($1, 10000, 'R2')", [id]))[0].admin_record_payment;
    await as(db, alice, "select public.cancel_booking($1, null)", [id]); // reverses everything
    await as(db, admin, "select public.admin_record_refund($1, 10000, 'cancelled')", [pay]);
    expect(Number((await row<{ c: string }>("select sum(commission_inr) c from public.commission_ledger where booking_id = $1", [id])).c)).toBe(0); // never negative
  });
});

describe("payment webhook foundation (server only, idempotent)", () => {
  async function asService<T>(fn: () => Promise<T>): Promise<T> {
    await db.exec("set role service_role");
    try { return await fn(); } finally { await db.exec("reset role"); }
  }
  const event = (id: string, type: string, booking: string | null, ref: string, amount: number) =>
    asService(async () => (await db.query<{ r: string }>("select public.record_payment_event('testgw', $1, $2, $3, $4, $5) as r", [id, type, booking, ref, amount])).rows[0].r);

  it("browsers cannot call it; the server can", async () => {
    for (const user of [null, alice, admin]) expect(await failure(db, user, "select public.record_payment_event('x','e','payment.captured',null,'r',1)")).toMatch(/permission denied/);
    for (const user of [null, alice, admin, host]) expect(await failure(db, user, "select * from public.payment_events")).toMatch(/permission denied/);
  });

  it("a captured payment is recorded once; a replayed event is a no-op", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 120, 121);
    await accept(host, id);
    expect(await event("evt_1", "payment.captured", id, "pay_1", 10000)).toBe("recorded");
    expect(await event("evt_1", "payment.captured", id, "pay_1", 10000)).toBe("duplicate");
    expect(await event("evt_2", "payment.captured", id, "pay_1", 10000)).toBe("recorded"); // same payment, new event id: still one payment
    expect(Number((await row<{ n: string }>("select count(*) n from public.payments where booking_id = $1", [id])).n)).toBe(1);
    expect((await row<{ s: string }>("select public.booking_payment_status($1) s", [id])).s).toBe("paid");
  });

  it("provider refunds reverse commission; failed events never mark anything paid; bad events are rejected", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 122, 123);
    await accept(host, id);
    await event("evt_10", "payment.captured", id, "pay_10", 10000);
    await event("evt_11", "refund.processed", id, "pay_10", 10000);
    expect((await row<{ s: string }>("select public.booking_payment_status($1) s", [id])).s).toBe("refunded");
    const pending = await request(bob, p, 124, 125);
    await expect(event("evt_12", "payment.captured", pending, "pay_12", 10000)).rejects.toThrow(/invalid_event/); // an unconfirmed request cannot be paid
    expect((await row<{ s: string }>("select public.booking_payment_status($1) s", [pending])).s).toBe("unpaid");
  });
});

describe("completion and settlements", () => {
  it("only the owning host or an admin completes a stay, and only after check-out", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 130, 131);
    await accept(host, id);
    expect(await failure(db, host, "select public.complete_booking($1)", [id])).toMatch(/stay_not_finished/);
    await db.query("update public.bookings set check_in = $2, check_out = $3 where id = $1", [id, dayOffset(-5), dayOffset(-3)]);
    for (const user of [alice, otherHost, bob]) expect(await failure(db, user, "select public.complete_booking($1)", [id])).toMatch(/forbidden/);
    await as(db, host, "select public.complete_booking($1)", [id]);
    expect((await row<{ status: string }>("select status from public.bookings where id = $1", [id])).status).toBe("completed");
    expect(await failure(db, host, "select public.complete_booking($1)", [id])).toMatch(/invalid_status/);
  });

  it("settles only completed, paid bookings, only once, and only an admin can", async () => {
    const h = await createUser(db, "settle-host@example.test", { account_type: "host", full_name: "Settle Host" });
    const p = await approvedListing(h);
    const unpaid = await pastCompletedBooking(p, alice);
    expect(await as(db, admin, "select * from public.admin_settleable_bookings($1)", [h])).toEqual([]); // not paid yet
    expect(await failure(db, admin, "select public.admin_create_settlement($1)", [h])).toMatch(/nothing_to_settle/);

    await as(db, admin, "select public.admin_record_payment($1, 10000, 'S1')", [unpaid]);
    const paid2 = await pastCompletedBooking(p, bob);
    await as(db, admin, "select public.admin_record_payment($1, 10000, 'S2')", [paid2]);
    const settleable = await as<{ net_host_share_inr: string }>(db, admin, "select * from public.admin_settleable_bookings($1)", [h]);
    expect(settleable.map((s) => Number(s.net_host_share_inr))).toEqual([8000, 8000]);

    for (const user of [h, alice, otherHost]) expect(await failure(db, user, "select public.admin_create_settlement($1)", [h])).toMatch(/forbidden/);
    const sid = (await as<{ admin_create_settlement: string }>(db, admin, "select public.admin_create_settlement($1, 'November')", [h]))[0].admin_create_settlement;
    const s = await row<{ amount_inr: string; status: string }>("select * from public.host_settlements where id = $1", [sid]);
    expect(Number(s.amount_inr)).toBe(16000);
    expect(s.status).toBe("pending");
    expect(await failure(db, admin, "select public.admin_create_settlement($1)", [h])).toMatch(/nothing_to_settle/); // each booking only once

    // visibility
    expect((await as(db, h, "select 1 from public.host_settlements where id = $1", [sid])).length).toBe(1);
    expect((await as(db, h, "select 1 from public.settlement_items where settlement_id = $1", [sid])).length).toBe(2);
    expect(await as(db, otherHost, "select 1 from public.host_settlements where id = $1", [sid])).toEqual([]);
    expect(await as(db, alice, "select 1 from public.settlement_items")).toEqual([]);

    // status machine: pending -> processing -> paid (needs a bank reference)
    expect(await failure(db, admin, "select public.admin_update_settlement($1, 'paid', 'REF')", [sid])).toMatch(/invalid_transition/);
    await as(db, admin, "select public.admin_update_settlement($1, 'processing')", [sid]);
    expect(await failure(db, admin, "select public.admin_update_settlement($1, 'paid')", [sid])).toMatch(/reference_required/);
    expect(await failure(db, h, "select public.admin_update_settlement($1, 'paid', 'REF')", [sid])).toMatch(/forbidden/);
    await as(db, admin, "select public.admin_update_settlement($1, 'paid', 'NEFT-123')", [sid]);
    const done = await row<{ status: string; reference: string; paid_at: string | null }>("select * from public.host_settlements where id = $1", [sid]);
    expect(done.status).toBe("paid");
    expect(done.reference).toBe("NEFT-123");
    expect(done.paid_at).not.toBeNull();
    expect((await row<{ settlement_status: string }>("select settlement_status from public.booking_financials where booking_id = $1", [unpaid])).settlement_status).toBe("paid");
  });

  it("payment is only required for settlement when the policy says so", async () => {
    const h = await createUser(db, "policy-host@example.test", { account_type: "host" });
    const p = await approvedListing(h);
    await pastCompletedBooking(p, alice);
    expect(await failure(db, admin, "select public.admin_create_settlement($1)", [h])).toMatch(/nothing_to_settle/);
    await setting("settlement_requires_payment", false);
    expect((await as(db, admin, "select public.admin_create_settlement($1)", [h])).length).toBe(1);
    await setting("settlement_requires_payment", true);
  });

  it("a fully refunded booking has nothing left to settle", async () => {
    const h = await createUser(db, "refund-host@example.test", { account_type: "host" });
    const p = await approvedListing(h);
    const b = await pastCompletedBooking(p, alice);
    const pay = (await as<{ admin_record_payment: string }>(db, admin, "select public.admin_record_payment($1, 10000, 'RF')", [b]))[0].admin_record_payment;
    await as(db, admin, "select public.admin_record_refund($1, 10000, 'refund')", [pay]);
    expect(await failure(db, admin, "select public.admin_create_settlement($1)", [h])).toMatch(/nothing_to_settle/);
  });
});

describe("booking history and financial view", () => {
  it("records every status change in order and shows it only to the parties", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 140, 141);
    await accept(host, id);
    await as(db, alice, "select public.cancel_booking($1, null)", [id]);
    const history = await as<{ from_status: string | null; to_status: string }>(db, alice, "select from_status, to_status from public.booking_status_history where booking_id = $1 order by id", [id]);
    expect(history.map((h) => `${h.from_status ?? "-"}>${h.to_status}`)).toEqual(["->requested", "requested>confirmed", "confirmed>cancelled_by_traveller"]);
    expect((await as(db, host, "select 1 from public.booking_status_history where booking_id = $1", [id])).length).toBe(3);
    expect(await as(db, bob, "select 1 from public.booking_status_history where booking_id = $1", [id])).toEqual([]);
    expect(await as(db, otherHost, "select 1 from public.booking_status_history where booking_id = $1", [id])).toEqual([]);
  });

  it("booking_financials gives a host, a traveller and an admin only their own rows", async () => {
    const p = await approvedListing(host);
    const id = await request(alice, p, 142, 143);
    await accept(host, id);
    const mine = await as<{ commission_amount_inr: string; host_share_inr: string; payment_status: string }>(db, host, "select * from public.booking_financials where booking_id = $1", [id]);
    expect(mine.length).toBe(1);
    expect(Number(mine[0].commission_amount_inr)).toBe(2000);
    expect(Number(mine[0].host_share_inr)).toBe(8000);
    expect(mine[0].payment_status).toBe("unpaid");
    expect((await as(db, alice, "select 1 from public.booking_financials where booking_id = $1", [id])).length).toBe(1);
    expect((await as(db, admin, "select 1 from public.booking_financials where booking_id = $1", [id])).length).toBe(1);
    expect(await as(db, otherHost, "select 1 from public.booking_financials where booking_id = $1", [id])).toEqual([]);
    expect(await as(db, bob, "select 1 from public.booking_financials where booking_id = $1", [id])).toEqual([]);
    expect(await failure(db, null, "select 1 from public.booking_financials")).toMatch(/permission denied/);
  });
});

describe("gardening enquiries are a separate module with a PIN and preferred slot", () => {
  it("stores a valid PIN and preferred date, rejects a malformed PIN, and creates no booking", async () => {
    const before = Number((await row<{ n: string }>("select count(*) n from public.bookings")).n);
    await db.query(
      `insert into public.gardening_enquiries (name, phone, location, property_type, pin_code, preferred_date, preferred_time_window, services)
       values ('Visitor', '+919000000009', 'Harohalli', 'Villa', '562112', $1, 'Morning', '{lawn-care}')`, [dayOffset(7)]);
    await expect(db.query("insert into public.gardening_enquiries (name, phone, location, property_type, pin_code) values ('V','+919000000009','x','Villa','56211')")).rejects.toThrow(/gardening_enquiries_pin/);
    expect(Number((await row<{ n: string }>("select count(*) n from public.bookings")).n)).toBe(before);
    expect((await as(db, admin, "select 1 from public.gardening_enquiries where pin_code = '562112'")).length).toBe(1);
    expect(await as(db, alice, "select 1 from public.gardening_enquiries")).toEqual([]);
  });
});

describe("complete marketplace flow (PRD critical test): host -> admin -> customer -> host -> customer", () => {
  it("runs the 15 steps and enforces the permission boundaries along the way", async () => {
    const pin = "560078";
    const e2eHost = await createUser(db, "e2e-host@example.test", { account_type: "host", full_name: "E2E Host" }); // 1. register a test host
    const customer = await createUser(db, "e2e-customer@example.test", { full_name: "E2E Customer" });
    const intruder = await createUser(db, "e2e-intruder@example.test", { account_type: "host", full_name: "Intruder Host" });
    const cat = await categoryId(db);

    // 2-5. draft with a real PIN, photos, pricing, availability, then submit
    const prop = (await as<{ id: string }>(db, e2eHost,
      `insert into public.properties (host_id, slug, name, category_id, description, city, state, postal_code, max_guests, price_inr, terms_accepted_at, photo_rights_confirmed_at)
       values ($1, 'e2e-stay', 'E2E Farm Stay', $2, 'A complete end-to-end listing with a long enough description for the review rules.', 'Jayanagar', 'Karnataka', $3, 6, 10000, now(), now()) returning id`,
      [e2eHost, cat, pin]))[0].id;
    await as(db, e2eHost, "insert into public.property_images (property_id, path, source) values ($1, '/images/x.jpg', 'static')", [prop]);
    await as(db, e2eHost, "insert into public.property_private (property_id, address_line, contact_name, contact_phone) values ($1, '4 Test Road', 'E2E Host', '+919000000002')", [prop]);
    await as(db, e2eHost, "insert into public.availability_blocks (property_id, start_date, end_date, reason) values ($1, $2, $3, 'maintenance')", [prop, dayOffset(200), dayOffset(205)]);
    await as(db, e2eHost, "select public.submit_property($1)", [prop]);

    // another host can neither edit nor submit it
    expect((await as(db, intruder, "update public.properties set name = 'Hijacked' where id = $1 returning id", [prop]))).toEqual([]);

    // unapproved: invisible to everyone but the owner/admin, not bookable, absent from PIN search
    expect(await search(null, pin)).toEqual([]);
    expect(await search(customer, pin)).toEqual([]);
    expect(await failure(db, customer, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(30), dayOffset(31)])).toMatch(/property_unavailable/);
    expect(await failure(db, customer, "select public.review_property($1, 'approve')", [prop])).toMatch(/forbidden/); // 6. customer cannot approve
    expect(await failure(db, e2eHost, "select public.review_property($1, 'approve')", [prop])).toMatch(/forbidden/);

    // 6-7. admin approves
    await as(db, admin, "select public.review_property($1, 'approve')", [prop]);

    // 8-10. customer searches by exact PIN, an unrelated PIN returns nothing
    expect((await search(customer, pin)).map((r) => r.id)).toEqual([prop]);
    expect((await search(null, "400001")).length).toBe(0);
    expect(Number((await as<{ q: { total: number } }>(db, customer, "select public.quote_stay($1,$2,$3,2) as q", [prop, dayOffset(30), dayOffset(31)]))[0].q.total)).toBe(10000);

    // 11. request; a second guest's overlapping request is allowed (pending) but only one can be confirmed
    const first = await request(customer, prop, 30, 31);
    const rival = await request(alice, prop, 30, 31);
    expect(await failure(db, customer, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(30), dayOffset(31)])).toMatch(/duplicate_request/);
    // blocked dates cannot be requested
    expect(await failure(db, customer, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(201), dayOffset(202)])).toMatch(/dates_unavailable/);

    // 12. the host (and only this host) sees and accepts it
    expect((await as(db, e2eHost, "select 1 from public.bookings where id = $1", [first])).length).toBe(1);
    expect(await as(db, intruder, "select 1 from public.bookings where id = $1", [first])).toEqual([]);
    expect(await failure(db, intruder, "select public.respond_to_booking($1, true, null)", [first])).toMatch(/forbidden/);
    expect(await failure(db, customer, "select public.respond_to_booking($1, true, null)", [first])).toMatch(/forbidden/);
    await as(db, e2eHost, "select public.respond_to_booking($1, true, 'Welcome!')", [first]);

    // overlapping acceptance is refused; the rival's request can be declined instead
    expect(await failure(db, e2eHost, "select public.respond_to_booking($1, true, null)", [rival])).toMatch(/dates_unavailable/);
    await as(db, e2eHost, "select public.respond_to_booking($1, false, 'Dates taken')", [rival]);

    // 13. the customer's dashboard shows the new status; the rival sees the rejection
    expect((await as<{ status: string }>(db, customer, "select status from public.bookings where id = $1", [first]))[0].status).toBe("confirmed");
    expect((await as<{ status: string }>(db, alice, "select status from public.bookings where id = $1", [rival]))[0].status).toBe("rejected");

    // 14. 20 % commission, 80 % host share, stored with the booking and in the ledger
    const fin = (await as<{ gross_inr: string; commission_rate_percent: string; commission_amount_inr: string; host_share_inr: string; net_commission_inr: string }>(
      db, e2eHost, "select * from public.booking_financials where booking_id = $1", [first]))[0];
    expect(Number(fin.gross_inr)).toBe(10000);
    expect(Number(fin.commission_rate_percent)).toBe(20);
    expect(Number(fin.commission_amount_inr)).toBe(2000);
    expect(Number(fin.host_share_inr)).toBe(8000);
    expect(Number(fin.net_commission_inr)).toBe(2000);

    // suspended listings leave search immediately
    await as(db, admin, "select public.review_property($1, 'suspend', 'Policy check')", [prop]);
    expect(await search(null, pin)).toEqual([]);
  });
});
