import { z } from "zod";

import { phoneSchema } from "@/lib/validation/common";

const t = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const opt = (max: number) => z.preprocess((v) => (v === undefined || v === null ? "" : v), z.string().trim().max(max));

export const addressSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  label: opt(40),
  full_name: t(2, 120, "Enter the recipient's full name"),
  phone: phoneSchema,
  line1: t(3, 200, "Enter the house, building and street"),
  line2: opt(200),
  landmark: opt(120),
  city: t(2, 120, "Enter the city or town"),
  state: t(2, 120, "Enter the state"),
  postal_code: z.string().trim().regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code"),
  is_default: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const cancelSchema = z.object({ order_id: z.uuid(), reason: opt(500) });
export const returnSchema = z.object({ order_id: z.uuid(), kind: z.enum(["return", "replacement"]), reason: t(3, 500, "Tell us what is wrong"), details: opt(2000) });
export const disputeSchema = z.object({ order_id: z.uuid(), description: t(10, 3000, "Please describe the problem (at least 10 characters)") });
export const trackingSchema = z.object({
  order_id: z.uuid(), carrier: t(2, 80, "Enter the carrier or courier name"), tracking: t(3, 80, "Enter the tracking number"),
  url: z.preprocess((v) => (v === undefined || v === null ? "" : v), z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//.test(v), "Use a full web address starting with http")),
});
export const decisionSchema = z.object({ id: z.uuid(), decision: z.enum(["approve", "reject", "complete"]), note: opt(1000) });
export const policySchema = z.object({
  category_id: z.coerce.number().int().positive(),
  returns_allowed: z.enum(["", "true", "false"]),
  return_window_days: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1).max(365).optional()),
  replacements_allowed: z.enum(["", "true", "false"]),
  replacement_window_days: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1).max(365).optional()),
  notes: opt(500),
});
