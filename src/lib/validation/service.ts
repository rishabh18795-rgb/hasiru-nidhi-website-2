import { z } from "zod";

import { phoneSchema } from "@/lib/validation/common";
import { istLocalToIso } from "@/lib/services";

const blank = (v: unknown) => (v === undefined || v === null ? "" : v);
const t = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const opt = (max: number) => z.preprocess(blank, z.string().trim().max(max));
const uuid = z.uuid();

export const serviceSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  name: t(3, 120, "Enter a service name (at least 3 characters)"),
  category_id: z.coerce.number({ error: "Choose a category" }).int().positive("Choose a category"),
  summary: opt(240),
  description: opt(8000),
  pricing_model: z.enum(["fixed", "quote"], { error: "Choose how this service is priced" }),
  price_inr: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().min(0.01, "Enter a price of at least ₹0.01").max(10000000).optional()),
  price_unit: opt(20),
  duration_minutes: z.coerce.number({ error: "Enter the length of one visit" }).int().min(15, "At least 15 minutes").max(480, "At most 8 hours (480 minutes)"),
  specifications: z.preprocess(blank, z.string().max(6000)),
}).superRefine((v, ctx) => {
  if (v.pricing_model === "fixed") {
    if (v.price_inr === undefined) ctx.addIssue({ code: "custom", path: ["price_inr"], message: "Enter the price for a fixed-price service" });
    if (!v.price_unit) ctx.addIssue({ code: "custom", path: ["price_unit"], message: "Choose what the price is per" });
  }
});

export const serviceRequestSchema = z.object({
  service_id: uuid,
  key: t(8, 80, "Please reload the page and try again."),
  quantity: z.preprocess((v) => (v === "" || v === undefined ? 1 : v), z.coerce.number().int().min(1).max(1000)),
  customer_name: t(2, 120, "Enter your name"),
  phone: phoneSchema,
  address_line: t(3, 300, "Enter the house, building and street where the work is needed"),
  city: t(2, 120, "Enter the city or town"),
  pin: z.string().trim().regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code"),
  property_type: opt(80),
  site_size: opt(80),
  details: opt(4000),
  preferred: opt(40),
});

export const quotationSchema = z.object({
  request_id: uuid,
  amount_inr: z.coerce.number({ error: "Enter the amount" }).min(0.01, "Enter an amount of at least ₹0.01").max(100000000),
  description: t(10, 4000, "Describe what the quotation covers (at least 10 characters)"),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose how long the quotation is valid"),
  proposed_start: opt(40),
  proposed_duration_minutes: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(15).max(720).optional()),
});

export const respondSchema = z.object({ request_id: uuid, decision: z.enum(["accept", "decline"]), reason: opt(1000) });
export const scheduleSchema = z.object({ request_id: uuid, start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time"), duration: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(15).max(720).optional()) });
export const cancelRequestSchema = z.object({ request_id: uuid, reason: opt(1000) });
export const decideQuotationSchema = z.object({ quotation_id: uuid, request_id: uuid, decision: z.enum(["accept", "decline"]), note: opt(1000) });
export const reviewServiceSchema = z.object({ service_id: uuid, decision: z.enum(["approve", "reject", "request_changes", "suspend", "reinstate"]), reason: opt(1000) });
export const timeOffSchema = z.object({ starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date"), ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an end date"), note: opt(200) });

/** The weekly-hours editor posts one "HH:MM" start and end per weekday; blank means not available that day. */
export function parseAvailability(raw: Record<string, string>): { rules: { weekday: number; start: string; end: string }[]; errors: string[] } {
  const rules: { weekday: number; start: string; end: string }[] = [];
  const errors: string[] = [];
  for (let d = 0; d < 7; d++) {
    const s = raw[`start_${d}`] ?? "";
    const e = raw[`end_${d}`] ?? "";
    if (!s && !e) continue;
    if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(e)) errors.push(`Enter both a start and an end time for day ${d}.`);
    else if (e <= s) errors.push("End time must be after the start time.");
    else rules.push({ weekday: d, start: s, end: e });
  }
  return { rules, errors };
}

export { istLocalToIso };
