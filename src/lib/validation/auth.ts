import { z } from "zod";

import { emailSchema, optionalPhone, passwordSchema } from "@/lib/validation/common";

export const signUpSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(120),
    email: emailSchema,
    phone: optionalPhone,
    password: passwordSchema,
    confirm_password: z.string(),
    accept_terms: z.literal("on", "You must accept the Terms and Privacy Policy"),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
    // Report a mismatch even when another field is also invalid (zod would otherwise skip this check).
    when: (payload) => {
      const v = payload.value as { password?: unknown; confirm_password?: unknown };
      return typeof v.password === "string" && typeof v.confirm_password === "string";
    },
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({ password: passwordSchema, confirm_password: z.string() })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
    // Report a mismatch even when another field is also invalid (zod would otherwise skip this check).
    when: (payload) => {
      const v = payload.value as { password?: unknown; confirm_password?: unknown };
      return typeof v.password === "string" && typeof v.confirm_password === "string";
    },
  });

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: optionalPhone,
});
