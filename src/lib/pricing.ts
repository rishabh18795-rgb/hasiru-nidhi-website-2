import type { PriceUnit } from "@/lib/db/types";

/**
 * Guest-facing price maths. This MUST stay identical to public.compute_stay_quote() in
 * supabase/migrations/20261021000200_listing_wizard_pricing.sql — the database is authoritative (it prices
 * the stored booking); this copy lets the wizard and booking panel preview the same number without a round trip.
 * A parity test (tests/db/pricing-parity.test.ts) runs both against the same inputs.
 */
export interface PricingRules {
  price_inr: number | null;
  price_unit: PriceUnit;
  /** Friday and Saturday nights. */
  weekend_price_inr?: number | null;
  /** Guests covered by the base price (per_night model only). */
  included_guests?: number | null;
  extra_guest_fee_inr?: number | null;
  cleaning_fee_inr?: number | null;
  tax_percent?: number | null;
  currency?: string;
}

export interface Quote {
  currency: string;
  unit: PriceUnit;
  nights: number;
  guests: number;
  weekend_nights: number;
  base: number;
  extra_guests: number;
  cleaning: number;
  subtotal: number;
  tax_percent: number;
  tax: number;
  total: number;
}

const DAY = 86_400_000;
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const paise = (rupees: number) => Math.round(rupees * 100);
const rupees = (p: number) => p / 100;

/** Returns null when there is no price (listing is "price on request") or the inputs are not a valid stay. */
export function quoteStay(rules: PricingRules, checkIn: string, checkOut: string, guests: number): Quote | null {
  if (rules.price_inr === null || rules.price_inr === undefined) return null;
  const nights = Math.round((toDay(checkOut) - toDay(checkIn)) / DAY);
  if (!Number.isFinite(nights) || nights < 1 || !Number.isInteger(guests) || guests < 1) return null;

  const rate = paise(rules.price_inr);
  const weekendRate = rules.weekend_price_inr === null || rules.weekend_price_inr === undefined ? null : paise(rules.weekend_price_inr);

  let weekendNights = 0;
  let nightly = 0;
  for (let i = 0; i < nights; i++) {
    const dow = new Date(toDay(checkIn) + i * DAY).getUTCDay();
    if (weekendRate !== null && (dow === 5 || dow === 6)) {
      weekendNights++;
      nightly += weekendRate;
    } else {
      nightly += rate;
    }
  }

  let base: number;
  let extra = 0;
  if (rules.price_unit === "per_person_night") {
    base = nightly * guests;
  } else if (rules.price_unit === "per_day_visit") {
    base = rate * guests;
    weekendNights = 0;
  } else {
    base = nightly;
    if (rules.included_guests != null && rules.extra_guest_fee_inr != null && guests > rules.included_guests) {
      extra = (guests - rules.included_guests) * paise(rules.extra_guest_fee_inr) * nights;
    }
  }

  const cleaning = paise(rules.cleaning_fee_inr ?? 0);
  const subtotal = base + extra + cleaning;
  const taxPercent = rules.tax_percent ?? 0;
  // Postgres round() is half-away-from-zero; amounts here are never negative, so floor(x + 0.5) matches it.
  const tax = Math.floor((subtotal * Math.round(taxPercent * 100)) / 10_000 + 0.5);

  return {
    currency: rules.currency ?? "INR",
    unit: rules.price_unit,
    nights,
    guests,
    weekend_nights: weekendNights,
    base: rupees(base),
    extra_guests: rupees(extra),
    cleaning: rupees(cleaning),
    subtotal: rupees(subtotal),
    tax_percent: taxPercent,
    tax: rupees(tax),
    total: rupees(subtotal + tax),
  };
}

/** The lines shown to a guest (and in the host's preview), omitting anything that is zero. */
export function quoteLines(q: Quote): { label: string; amount: number }[] {
  const unitLabel = q.unit === "per_person_night" ? `${q.guests} guest${q.guests === 1 ? "" : "s"} × ${q.nights} night${q.nights === 1 ? "" : "s"}` : `${q.nights} night${q.nights === 1 ? "" : "s"}`;
  const lines = [{ label: q.unit === "per_day_visit" ? `${q.guests} guest${q.guests === 1 ? "" : "s"}` : unitLabel + (q.weekend_nights ? ` (${q.weekend_nights} at weekend rate)` : ""), amount: q.base }];
  if (q.extra_guests) lines.push({ label: "Additional guests", amount: q.extra_guests });
  if (q.cleaning) lines.push({ label: "Cleaning fee", amount: q.cleaning });
  if (q.tax) lines.push({ label: `Taxes (${q.tax_percent}%)`, amount: q.tax });
  return lines;
}

export interface StayLengthRules { min_nights: number; max_nights: number }

/** Human message for a stay outside the host's minimum/maximum (null when fine). Server re-checks authoritatively. */
export function stayLengthProblem(nights: number, r: StayLengthRules): string | null {
  if (nights < r.min_nights) return `This property needs a stay of at least ${r.min_nights} night${r.min_nights === 1 ? "" : "s"}.`;
  if (nights > r.max_nights) return `This property accepts stays of up to ${r.max_nights} night${r.max_nights === 1 ? "" : "s"}.`;
  return null;
}
