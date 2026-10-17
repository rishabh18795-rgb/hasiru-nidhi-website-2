import { z } from "zod";

import { isoDate, uuidSchema } from "@/lib/validation/common";

export const stayRequestSchema = z
  .object({
    property_id: uuidSchema,
    check_in: isoDate,
    check_out: isoDate,
    adults: z.coerce.number().int().min(1, "At least one adult").max(200),
    children: z.coerce.number().int().min(0).max(200).default(0),
    message: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.check_out > v.check_in, { path: ["check_out"], message: "Check-out must be after check-in" });

export const bookingResponseSchema = z.object({
  booking_id: uuidSchema,
  decision: z.enum(["accept", "decline"]),
  note: z.string().trim().max(1000).optional(),
});

export const cancelSchema = z.object({
  booking_id: uuidSchema,
  note: z.string().trim().max(1000).optional(),
});

export const reviewSchema = z.object({
  booking_id: uuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export const availabilityBlockSchema = z
  .object({
    property_id: uuidSchema,
    start_date: isoDate,
    end_date: isoDate,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: "End date must be after start date" });
