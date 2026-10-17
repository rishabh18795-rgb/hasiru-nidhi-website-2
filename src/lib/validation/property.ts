import { z } from "zod";

import { emailSchema, optionalEmail, optionalPhone, phoneSchema } from "@/lib/validation/common";

export const cancellationPolicies = [
  { value: "flexible", label: "Flexible — full refund up to 24 hours before check-in" },
  { value: "moderate", label: "Moderate — full refund up to 5 days before check-in" },
  { value: "strict", label: "Strict — 50% refund up to 14 days before check-in" },
] as const;

export const priceUnits = [
  { value: "per_night", label: "per night (whole property / room)" },
  { value: "per_person_night", label: "per person, per night" },
  { value: "per_day_visit", label: "per person, day visit" },
] as const;

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= min && v <= max), `Enter a number between ${min} and ${max}`);

const requiredInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, `${label} must be between ${min} and ${max}`)
    .transform(Number);

export const propertyFormSchema = z.object({
  name: z.string().trim().min(3, "Enter the property name (min 3 characters)").max(120),
  category_id: z.string().regex(/^\d+$/, "Choose a category").transform(Number),
  summary: z.string().trim().max(240, "Keep the summary under 240 characters").optional(),
  description: z.string().trim().max(8000),
  city: z.string().trim().min(2, "Enter the city or town").max(120),
  state: z.string().trim().min(2, "Enter the state").max(120),
  region: z.string().trim().max(120).optional(),
  postal_code: z.string().trim().max(10).optional(),
  rooms_count: requiredInt(1, 200, "Rooms"),
  max_guests: requiredInt(1, 500, "Guest capacity"),
  price_inr: optionalNumber(0, 10_000_000),
  price_unit: z.enum(["per_night", "per_person_night", "per_day_visit"]),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  house_rules: z.string().trim().max(3000).optional(),
  cancellation_policy: z.enum(["flexible", "moderate", "strict"]),
  amenity_ids: z.array(z.string().regex(/^\d+$/).transform(Number)).default([]),
  experience_ids: z.array(z.string().regex(/^\d+$/).transform(Number)).default([]),
  // private owner details
  address_line: z.string().trim().max(300).optional(),
  contact_name: z.string().trim().max(120).optional(),
  contact_email: optionalEmail,
  contact_phone: optionalPhone,
  current_platforms: z.string().trim().max(300).optional(),
  partnership_model: z.string().trim().max(300).optional(),
  accept_terms: z.string().optional(),
});

export type PropertyFormInput = z.infer<typeof propertyFormSchema>;

export const roomTypeSchema = z.object({
  property_id: z.uuid(),
  name: z.string().trim().min(2, "Enter a room name").max(80),
  capacity: requiredInt(1, 50, "Capacity"),
  quantity: requiredInt(1, 200, "Number of rooms"),
  price_inr: optionalNumber(0, 10_000_000),
  description: z.string().trim().max(500).optional(),
});

export { emailSchema, phoneSchema };

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "property";
}
