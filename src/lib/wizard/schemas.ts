import { z } from "zod";

import { optionalEmail, phoneSchema } from "@/lib/validation/common";
import type { WizardStepKey } from "@/lib/wizard/steps";

/* ----------------------------------------------------------------------------------------------
 * One zod schema per wizard step.
 *  - "Continue" validates STRICTLY (every required field).
 *  - "Save draft" validates LENIENTLY: blank fields are treated as "not filled in yet", but anything the
 *    host did type must still be well-formed. (Blank keys are dropped, then the schema is .partial().)
 * Cross-field rules live in crossChecks() so partial() stays available.
 * -------------------------------------------------------------------------------------------- */

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const blankToUndefined = (v: unknown) => (isBlank(v) ? undefined : v);

const text = (label: string, min: number, max: number) =>
  z.string({ error: `${label} is required` }).trim().min(min, min <= 1 ? `${label} is required` : `${label} needs at least ${min} characters`).max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max, `Keep this under ${max} characters`).optional());

const num = (label: string, min: number, max: number, opts: { int?: boolean; step?: number } = {}) =>
  z.preprocess(
    (v) => (isBlank(v) ? undefined : Number(v)),
    z
      .number({ error: `${label}: enter a number` })
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .refine((n) => !opts.int || Number.isInteger(n), `${label} must be a whole number`)
      .refine((n) => !opts.step || Math.abs(n / opts.step - Math.round(n / opts.step)) < 1e-9, `${label} must be in steps of ${opts.step}`),
  );

const optionalNum = (label: string, min: number, max: number, opts: { int?: boolean } = {}) =>
  z.preprocess(blankToUndefined, num(label, min, max, opts).optional());

const idList = z.array(z.string().regex(/^\d+$/).transform(Number)).max(100).default([]);
const time = z.string({ error: "Choose a time" }).regex(/^\d{2}:\d{2}$/, "Choose a time");
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const ARRANGEMENTS = [
  { value: "entire_property", label: "Entire property — guests have it to themselves" },
  { value: "private_rooms", label: "Private rooms — guests have their own room(s) in a shared property" },
  { value: "shared_space", label: "Shared space — guests share rooms or common areas" },
] as const;

export const PRICING_MODELS = [
  { value: "per_night", label: "Per night — one price for the whole property" },
  { value: "per_person_night", label: "Per guest, per night" },
] as const;

export const cancellationOptions = [
  { value: "flexible", label: "Flexible — full refund up to 24 hours before check-in" },
  { value: "moderate", label: "Moderate — full refund up to 5 days before check-in" },
  { value: "strict", label: "Strict — 50% refund up to 14 days before check-in" },
] as const;

export const stepSchemas = {
  type: z.object({
    name: text("Property name", 3, 120),
    category_id: num("Property type", 1, 1_000_000_000, { int: true }),
  }),
  location: z.object({
    country: text("Country", 2, 80),
    state: text("State", 2, 120),
    city: text("City or town", 2, 120),
    region: optionalText(120),
    postal_code: text("Postal code", 3, 10),
    address_line: text("Full address", 5, 300),
    latitude: optionalNum("Latitude", -90, 90),
    longitude: optionalNum("Longitude", -180, 180),
    location_precision: z.enum(["approximate", "exact"], { error: "Choose how your location is shown" }),
  }),
  details: z.object({
    summary: optionalText(240),
    description: text("Description", 50, 8000),
    rooms_count: num("Number of rooms", 1, 200, { int: true }),
    max_guests: num("Guest capacity", 1, 500, { int: true }),
    bedrooms: num("Bedrooms", 0, 100, { int: true }),
    beds: num("Beds", 0, 300, { int: true }),
    bathrooms: num("Bathrooms", 0, 100, { step: 0.5 }),
    accommodation_arrangement: z.enum(["entire_property", "private_rooms", "shared_space"], { error: "Choose the accommodation arrangement" }),
    check_in_time: time,
    check_out_time: time,
    house_rules: optionalText(3000),
  }),
  photos: z.object({}),
  amenities: z.object({
    amenity_ids: idList,
    experience_ids: idList,
  }),
  pricing: z.object({
    price_unit: z.enum(["per_night", "per_person_night"], { error: "Choose a pricing model" }),
    price_inr: num("Price", 1, 10_000_000),
    weekend_price_inr: optionalNum("Weekend price", 0, 10_000_000),
    included_guests: optionalNum("Guests included in the price", 1, 500, { int: true }),
    extra_guest_fee_inr: optionalNum("Extra-guest charge", 0, 1_000_000),
    cleaning_fee_inr: optionalNum("Cleaning fee", 0, 1_000_000),
    tax_percent: z.preprocess((v) => (isBlank(v) ? 0 : Number(v)), z.number({ error: "Tax: enter a number" }).min(0, "Tax cannot be negative").max(40, "Tax cannot exceed 40%")),
    min_nights: z.preprocess((v) => (isBlank(v) ? 1 : Number(v)), z.number({ error: "Minimum stay: enter a number" }).int().min(1, "Minimum stay is at least 1 night").max(30, "Minimum stay is at most 30 nights")),
    max_nights: z.preprocess((v) => (isBlank(v) ? 30 : Number(v)), z.number({ error: "Maximum stay: enter a number" }).int().min(1, "Maximum stay is at least 1 night").max(30, "Online stays are limited to 30 nights")),
  }),
  availability: z.object({}),
  review: z.object({
    cancellation_policy: z.enum(["flexible", "moderate", "strict"], { error: "Choose a cancellation policy" }),
    contact_name: text("Contact person", 2, 120),
    contact_phone: phoneSchema,
    contact_email: optionalEmail,
    current_platforms: optionalText(300),
    partnership_model: optionalText(300),
    accept_terms: checkbox.refine((v) => v, "You must confirm the information is accurate and accept the host terms"),
    accept_photo_rights: checkbox.refine((v) => v, "Please confirm you have the right to use the photographs"),
  }),
} satisfies Record<WizardStepKey, z.ZodObject>;

export type StepInput<K extends WizardStepKey> = z.infer<(typeof stepSchemas)[K]>;

export type FieldErrors = Record<string, string[] | undefined>;

/** Everything the form posts, with multi-value fields gathered into arrays. */
export function collectStepValues(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = key === "amenity_ids" || key === "experience_ids" ? all : all[all.length - 1];
  }
  return out;
}

/** Parse one step. `strict` = Continue; otherwise Save draft (blank = not filled in yet). */
export function parseStep<K extends WizardStepKey>(
  step: K,
  input: Record<string, unknown>,
  strict: boolean,
): { ok: true; data: Partial<StepInput<K>> } | { ok: false; errors: FieldErrors } {
  const schema = stepSchemas[step] as z.ZodObject;
  let candidate = input;
  let target: z.ZodType = schema;
  if (!strict) {
    candidate = Object.fromEntries(Object.entries(input).filter(([, v]) => !isBlank(v)));
    target = schema.partial();
  }
  const res = target.safeParse(candidate);
  if (!res.success) return { ok: false, errors: z.flattenError(res.error).fieldErrors as FieldErrors };
  return { ok: true, data: res.data as Partial<StepInput<K>> };
}

/** Rules that involve more than one field (or, with `context`, the saved listing). */
export function crossChecks(
  step: WizardStepKey,
  data: Record<string, unknown>,
  strict: boolean,
  context: { country?: string; max_guests?: number } = {},
): FieldErrors {
  const errors: FieldErrors = {};
  const add = (field: string, message: string) => (errors[field] = [...(errors[field] ?? []), message]);

  if (step === "location") {
    const lat = data.latitude as number | undefined;
    const lng = data.longitude as number | undefined;
    if ((lat === undefined) !== (lng === undefined)) add(lat === undefined ? "latitude" : "longitude", "Enter both latitude and longitude, or leave both empty");
    const country = String(data.country ?? "");
    const pin = data.postal_code as string | undefined;
    if (pin && country.trim().toLowerCase() === "india" && !/^\d{6}$/.test(pin)) add("postal_code", "An Indian PIN code has 6 digits");
    if (strict && lat === undefined && data.location_precision === "exact") add("latitude", "Add the coordinates to show an exact pin, or choose approximate");
  }

  if (step === "pricing") {
    const min = data.min_nights as number | undefined;
    const max = data.max_nights as number | undefined;
    if (min !== undefined && max !== undefined && max < min) add("max_nights", "Maximum stay must be at least the minimum stay");
    const inc = data.included_guests as number | undefined;
    const fee = data.extra_guest_fee_inr as number | undefined;
    if (data.price_unit !== "per_person_night" && (inc === undefined) !== (fee === undefined)) {
      add(inc === undefined ? "included_guests" : "extra_guest_fee_inr", "Set both the guests included and the extra-guest charge, or neither");
    }
    if (inc !== undefined && context.max_guests !== undefined && inc > context.max_guests) add("included_guests", `Cannot exceed your guest capacity (${context.max_guests})`);
  }

  return errors;
}

/** Public map pins are rounded to ~1 km unless the host chose to show the exact location. */
export function publicCoordinate(value: number | undefined, precision: "approximate" | "exact" | undefined): number | null {
  if (value === undefined) return null;
  return precision === "exact" ? Math.round(value * 1e6) / 1e6 : Math.round(value * 100) / 100;
}
