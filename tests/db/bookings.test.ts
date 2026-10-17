import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, dayOffset, failure, insertApprovedProperty, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;
let host: string;
let guestA: string;
let guestB: string;
let stranger: string;
let prop: string;

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@example.test");
  host = await createUser(db, "host@example.test", { account_type: "host", full_name: "Host" });
  guestA = await createUser(db, "ga@example.test", { full_name: "Guest A", phone: "+919000000002" });
  guestB = await createUser(db, "gb@example.test", { full_name: "Guest B" });
  stranger = await createUser(db, "stranger@example.test");
  prop = await insertApprovedProperty(db, host, { max_guests: 4, price: 5000 });
});

const request = (user: string, p: string, inD: string, outD: string, adults = 2, children = 0, msg: string | null = null) =>
  as<{ request_booking: string }>(db, user, "select public.request_booking($1,$2,$3,$4,$5,$6)", [p, inD, outD, adults, children, msg]);

const statusOf = async (id: string) =>
  (await db.query<{ status: string }>("select status from public.bookings where id = $1", [id])).rows[0].status;

describe("request_booking validation", () => {
  it("requires authentication", async () => {
    expect(await failure(db, null, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(30), dayOffset(32)])).toMatch(/permission denied/);
  });

  it("creates a REQUESTED (not confirmed) booking with snapshots and an indicative total", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(30), dayOffset(32), 2, 1, "Anniversary trip");
    const row = (await db.query<Record<string, unknown>>("select * from public.bookings where id = $1", [id])).rows[0];
    expect(row).toMatchObject({
      status: "requested",
      guest_name: "Guest A",
      guest_phone: "+919000000002",
      property_name: "Test Cottage",
      adults: 2,
      children: 1,
    });
    expect(Number(row.indicative_total_inr)).toBe(10000); // 2 nights x 5000
  });

  it("notifies host and traveller, and never claims confirmation", async () => {
    const hostN = await as<{ title: string }>(db, host, "select title from public.notifications where kind = 'booking_requested'");
    expect(hostN.length).toBeGreaterThanOrEqual(1);
    const guestN = await as<{ body: string }>(db, guestA, "select body from public.notifications where kind = 'booking_requested'");
    expect(guestN[0].body).toMatch(/not a confirmed reservation/i);
  });

  it.each([
    ["past check-in", dayOffset(-3), dayOffset(-1), 2, 0, /invalid_dates/],
    ["check-out before check-in", dayOffset(40), dayOffset(38), 2, 0, /invalid_dates/],
    ["zero-night stay", dayOffset(40), dayOffset(40), 2, 0, /invalid_dates/],
    ["stay over 30 nights", dayOffset(40), dayOffset(80), 2, 0, /invalid_dates/],
    ["over capacity", dayOffset(40), dayOffset(42), 3, 2, /invalid_guests/],
    ["no adults", dayOffset(40), dayOffset(42), 0, 2, /invalid_guests/],
  ])("rejects %s", async (_label, inD, outD, adults, children, pattern) => {
    expect(await failure(db, guestB, "select public.request_booking($1,$2,$3,$4,$5,null)", [prop, inD, outD, adults, children])).toMatch(pattern as RegExp);
  });

  it("rejects bookings on listings that are not approved", async () => {
    const draft = (await db.query<{ id: string }>(
      "insert into public.properties (host_id, slug, name) values ($1, 'not-live', 'Not Live') returning id", [host])).rows[0].id;
    expect(await failure(db, guestB, "select public.request_booking($1,$2,$3,2,0,null)", [draft, dayOffset(40), dayOffset(42)])).toMatch(/property_unavailable/);
  });

  it("stops a host booking their own property", async () => {
    expect(await failure(db, host, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(40), dayOffset(42)])).toMatch(/own_property/);
  });

  it("stops an identical duplicate request by the same traveller", async () => {
    await request(guestB, prop, dayOffset(50), dayOffset(52));
    expect(await failure(db, guestB, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(51), dayOffset(53)])).toMatch(/duplicate_request/);
  });

  it("a suspended account cannot request bookings", async () => {
    const s = await createUser(db, "susp@example.test");
    await db.query("update public.profiles set is_suspended = true where id = $1", [s]);
    expect(await failure(db, s, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(60), dayOffset(62)])).toMatch(/account_suspended/);
  });
});

describe("clients can never write bookings directly", () => {
  it("direct INSERT is denied", async () => {
    const msg = await failure(db, guestA, `
      insert into public.bookings (property_id, traveller_id, check_in, check_out, adults, status, property_name, cancellation_policy)
      values ($1, $2, $3, $4, 2, 'confirmed', 'x', 'flexible')`, [prop, guestA, dayOffset(70), dayOffset(72)]);
    expect(msg).toMatch(/permission denied/);
  });

  it("a traveller cannot confirm their own booking by UPDATE", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(75), dayOffset(77));
    expect(await failure(db, guestA, "update public.bookings set status = 'confirmed' where id = $1", [id])).toMatch(/permission denied/);
    expect(await statusOf(id)).toBe("requested");
  });
});

describe("booking visibility", () => {
  it("is limited to the traveller, the host and admins", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(90), dayOffset(92));
    expect(await as(db, guestA, "select id from public.bookings where id = $1", [id])).toHaveLength(1);
    expect(await as(db, host, "select id from public.bookings where id = $1", [id])).toHaveLength(1);
    expect(await as(db, admin, "select id from public.bookings where id = $1", [id])).toHaveLength(1);
    expect(await as(db, guestB, "select id from public.bookings where id = $1", [id])).toHaveLength(0);
    expect(await as(db, stranger, "select id from public.bookings where id = $1", [id])).toHaveLength(0);
    expect(await failure(db, null, "select id from public.bookings")).toMatch(/permission denied/);
  });

  it("another host cannot see bookings on a property they do not own", async () => {
    const otherHost = await createUser(db, "otherhost@example.test", { account_type: "host" });
    expect(await as(db, otherHost, "select id from public.bookings")).toHaveLength(0);
  });
});

describe("host decisions and double-booking prevention", () => {
  it("only the owning host (or admin) can respond", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(100), dayOffset(102));
    expect(await failure(db, stranger, "select public.respond_to_booking($1, true, null)", [id])).toMatch(/forbidden/);
    expect(await failure(db, guestA, "select public.respond_to_booking($1, true, null)", [id])).toMatch(/forbidden/);
    await as(db, host, "select public.respond_to_booking($1, true, 'See you soon')", [id]);
    expect(await statusOf(id)).toBe("confirmed");
  });

  it("a confirmed stay blocks overlapping requests", async () => {
    // 100->102 is confirmed above
    expect(await failure(db, guestB, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(101), dayOffset(103)])).toMatch(/dates_unavailable/);
    expect(await failure(db, guestB, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(99), dayOffset(101)])).toMatch(/dates_unavailable/);
  });

  it("back-to-back stays are allowed (check-out day can be the next check-in)", async () => {
    const [{ request_booking: id }] = await request(guestB, prop, dayOffset(102), dayOffset(104));
    await as(db, host, "select public.respond_to_booking($1, true, null)", [id]);
    expect(await statusOf(id)).toBe("confirmed");
  });

  it("two overlapping REQUESTS can coexist, but only one can be confirmed", async () => {
    const [{ request_booking: a }] = await request(guestA, prop, dayOffset(120), dayOffset(123));
    const [{ request_booking: b }] = await request(guestB, prop, dayOffset(121), dayOffset(124));
    await as(db, host, "select public.respond_to_booking($1, true, null)", [a]);
    expect(await failure(db, host, "select public.respond_to_booking($1, true, null)", [b])).toMatch(/dates_unavailable/);
    expect(await statusOf(a)).toBe("confirmed");
    expect(await statusOf(b)).toBe("requested");
    // The host can still decline the loser.
    await as(db, host, "select public.respond_to_booking($1, false, 'Dates taken')", [b]);
    expect(await statusOf(b)).toBe("rejected");
  });

  it("the database constraint itself refuses overlapping confirmed bookings, even to the owner", async () => {
    const msg = await db
      .query(
        `insert into public.bookings (property_id, traveller_id, check_in, check_out, adults, status, property_name, cancellation_policy)
         values ($1, $2, $3, $4, 2, 'confirmed', 'x', 'flexible')`,
        [prop, guestB, dayOffset(121), dayOffset(122)],
      )
      .then(() => "inserted")
      .catch((e: Error) => e.message);
    expect(msg).toMatch(/bookings_no_confirmed_overlap|conflicting key/);
  });

  it("a request cannot be answered twice", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(140), dayOffset(141));
    await as(db, host, "select public.respond_to_booking($1, false, null)", [id]);
    expect(await failure(db, host, "select public.respond_to_booking($1, true, null)", [id])).toMatch(/invalid_status/);
  });

  it("confirming notifies the traveller", async () => {
    const n = await as<{ kind: string }>(db, guestA, "select kind from public.notifications where kind = 'booking_confirmed'");
    expect(n.length).toBeGreaterThanOrEqual(1);
  });
});

describe("host-blocked dates", () => {
  it("block requests for those dates", async () => {
    await as(db, host, "insert into public.availability_blocks (property_id, start_date, end_date, reason) values ($1,$2,$3,'Maintenance')", [prop, dayOffset(160), dayOffset(165)]);
    expect(await failure(db, guestA, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(162), dayOffset(164)])).toMatch(/dates_unavailable/);
  });

  it("cannot be placed over a confirmed booking", async () => {
    expect(await failure(db, host, "insert into public.availability_blocks (property_id, start_date, end_date) values ($1,$2,$3)", [prop, dayOffset(100), dayOffset(101)])).toMatch(/blocks_confirmed_booking/);
  });

  it("are private, but the public calendar still gets anonymised ranges", async () => {
    expect(await as(db, guestA, "select * from public.availability_blocks")).toHaveLength(0);
    const ranges = await as<{ start_date: string; end_date: string }>(db, null, "select * from public.property_unavailable_ranges($1)", [prop]);
    expect(ranges.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(ranges[0]).sort()).toEqual(["end_date", "start_date"]);
  });

  it("other users cannot block or unblock a host's calendar", async () => {
    expect(await failure(db, guestA, "insert into public.availability_blocks (property_id, start_date, end_date) values ($1,$2,$3)", [prop, dayOffset(200), dayOffset(201)])).toMatch(/row-level security/);
  });
});

describe("cancellation", () => {
  it("a traveller can cancel their own request or confirmed stay, but not others'", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(210), dayOffset(212));
    expect(await failure(db, guestB, "select public.cancel_booking($1, null)", [id])).toMatch(/forbidden/);
    await as(db, guestA, "select public.cancel_booking($1, 'Plans changed')", [id]);
    expect(await statusOf(id)).toBe("cancelled_by_traveller");
    const hn = await as<{ kind: string }>(db, host, "select kind from public.notifications where kind = 'booking_cancelled'");
    expect(hn.length).toBeGreaterThanOrEqual(1);
  });

  it("cancelling a confirmed stay frees the dates", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(220), dayOffset(222));
    await as(db, host, "select public.respond_to_booking($1, true, null)", [id]);
    expect(await failure(db, guestB, "select public.request_booking($1,$2,$3,2,0,null)", [prop, dayOffset(220), dayOffset(222)])).toMatch(/dates_unavailable/);
    await as(db, guestA, "select public.cancel_booking($1, null)", [id]);
    await request(guestB, prop, dayOffset(220), dayOffset(222));
  });

  it("host cancellation is recorded as such", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(230), dayOffset(231));
    await as(db, host, "select public.respond_to_booking($1, true, null)", [id]);
    await as(db, host, "select public.cancel_booking($1, 'Unforeseen repairs')", [id]);
    expect(await statusOf(id)).toBe("cancelled_by_host");
  });

  it("an already-cancelled booking cannot be cancelled again", async () => {
    const [{ request_booking: id }] = await request(guestA, prop, dayOffset(240), dayOffset(241));
    await as(db, guestA, "select public.cancel_booking($1, null)", [id]);
    expect(await failure(db, guestA, "select public.cancel_booking($1, null)", [id])).toMatch(/invalid_status/);
  });
});

describe("reviews exist only for real, finished stays", () => {
  let pastBooking: string;
  let futureBooking: string;

  beforeAll(async () => {
    pastBooking = (await db.query<{ id: string }>(
      `insert into public.bookings (property_id, traveller_id, check_in, check_out, adults, status, property_name, cancellation_policy)
       values ($1, $2, $3, $4, 2, 'confirmed', 'Test Cottage', 'moderate') returning id`,
      [prop, guestA, dayOffset(-10), dayOffset(-8)])).rows[0].id;
    futureBooking = (await request(guestA, prop, dayOffset(300), dayOffset(301)))[0].request_booking;
    await as(db, host, "select public.respond_to_booking($1, true, null)", [futureBooking]);
  });

  it("allows a review after a confirmed stay has ended", async () => {
    await as(db, guestA, "insert into public.reviews (booking_id, property_id, traveller_id, rating, comment) values ($1,$2,$3,5,'Lovely')", [pastBooking, prop, guestA]);
    const rows = await as(db, null, "select rating from public.reviews where property_id = $1", [prop]);
    expect(rows).toHaveLength(1);
  });

  it("refuses a second review for the same stay", async () => {
    expect(await failure(db, guestA, "insert into public.reviews (booking_id, property_id, traveller_id, rating) values ($1,$2,$3,4)", [pastBooking, prop, guestA])).toMatch(/duplicate|unique/);
  });

  it("refuses a review for a stay that has not happened yet", async () => {
    expect(await failure(db, guestA, "insert into public.reviews (booking_id, property_id, traveller_id, rating) values ($1,$2,$3,5)", [futureBooking, prop, guestA])).toMatch(/row-level security/);
  });

  it("refuses a review by someone who did not stay", async () => {
    expect(await failure(db, guestB, "insert into public.reviews (booking_id, property_id, traveller_id, rating) values ($1,$2,$3,5)", [pastBooking, prop, guestB])).toMatch(/row-level security/);
    expect(await failure(db, guestB, "insert into public.reviews (booking_id, property_id, traveller_id, rating) values ($1,$2,$3,1)", [pastBooking, prop, guestA])).toMatch(/row-level security/);
  });

  it("rating must be 1-5", async () => {
    expect(await failure(db, guestA, "insert into public.reviews (booking_id, property_id, traveller_id, rating) values ($1,$2,$3,9)", [futureBooking, prop, guestA])).toMatch(/violates|row-level/);
  });
});
