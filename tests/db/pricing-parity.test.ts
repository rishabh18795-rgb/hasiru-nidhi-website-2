import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, insertApprovedProperty, type Db } from "./harness";
import { quoteStay, type PricingRules } from "@/lib/pricing";

let db: Db;
let host: string;

beforeAll(async () => {
  db = await createDb();
  host = await createUser(db, "host@example.test", { account_type: "host" });
});

// Deterministic pseudo-random generator so a failure is reproducible.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
const money = (r: () => number, max: number) => Math.round(r() * max * 100) / 100;

describe("pricing: TypeScript preview == database quote", () => {
  it("agrees on 300 random listings, stays and guest counts (weekends, extras, cleaning, tax, rounding)", async () => {
    const r = rng(20261021);
    const id = await insertApprovedProperty(db, host);
    let checked = 0;
    for (let i = 0; i < 300; i++) {
      const rules: PricingRules = {
        price_inr: pick(r, [null, 0, 999, 1234.5, money(r, 20000)]),
        price_unit: pick(r, ["per_night", "per_person_night", "per_day_visit"] as const),
        weekend_price_inr: pick(r, [null, null, money(r, 30000)]),
        included_guests: pick(r, [null, 1, 2, 4]),
        extra_guest_fee_inr: pick(r, [null, 0, 333.33, money(r, 2000)]),
        cleaning_fee_inr: pick(r, [null, 0, 499.99, money(r, 5000)]),
        tax_percent: pick(r, [0, 5, 12, 18, 7.25, 0.01]),
      };
      const start = new Date(Date.UTC(2027, 0, 1) + Math.floor(r() * 400) * 86400000);
      const nights = 1 + Math.floor(r() * 14);
      const guests = 1 + Math.floor(r() * 9);
      const ci = start.toISOString().slice(0, 10);
      const co = new Date(start.getTime() + nights * 86400000).toISOString().slice(0, 10);

      await db.query(
        `update public.properties set price_inr=$2, price_unit=$3, weekend_price_inr=$4, included_guests=$5,
           extra_guest_fee_inr=$6, cleaning_fee_inr=$7, tax_percent=$8, max_guests=500 where id=$1`,
        [id, rules.price_inr, rules.price_unit, rules.weekend_price_inr, rules.included_guests, rules.extra_guest_fee_inr, rules.cleaning_fee_inr, rules.tax_percent],
      );
      const [row] = await as<{ q: Record<string, number | string> | null }>(db, null, "select public.quote_stay($1,$2,$3,$4) as q", [id, ci, co, guests]);
      const mine = quoteStay(rules, ci, co, guests);
      if (row.q === null) {
        expect(mine, JSON.stringify({ rules, ci, co, guests })).toBeNull();
      } else {
        expect(mine, JSON.stringify({ rules, ci, co, guests })).toMatchObject(row.q);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
});
