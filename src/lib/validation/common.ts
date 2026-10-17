import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => /^\+?\d{8,15}$/.test(v), "Enter a valid phone number, e.g. +91 98765 43210");

/** A missing field and an empty string both mean "not provided". */
const blankIfMissing = (v: unknown) => (v === undefined || v === null ? "" : v);

export const optionalPhone = z.preprocess(
  blankIfMissing,
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => v === "" || /^\+?\d{8,15}$/.test(v), "Enter a valid phone number")
    .transform((v) => (v === "" ? undefined : v)),
);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));

export const optionalEmail = z.preprocess(
  blankIfMissing,
  z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address")
    .transform((v) => (v === "" ? undefined : v)),
);

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Choose a valid date");

export const uuidSchema = z.uuid("Invalid identifier");

/** Spam trap: a hidden field real users never fill. */
export const honeypot = z.string().max(0).optional();

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");
