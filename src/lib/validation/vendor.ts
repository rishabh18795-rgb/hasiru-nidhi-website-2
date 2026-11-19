import { z } from "zod";

import { optionalEmail, optionalPhone } from "@/lib/validation/common";

export const BUSINESS_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "company", label: "Company" },
  { value: "farm", label: "Farm or grower" },
  { value: "other", label: "Other" },
] as const;

export const CAPABILITY_INFO = {
  products: { label: "Sell products", help: "Plants, tools, compost, produce, handmade and lifestyle products delivered to customers." },
  services: { label: "Offer services", help: "Gardening, landscaping and related services, by fixed price or quotation." },
  stays: { label: "Host nature stays", help: "List a farm stay, cottage or homestay. Existing hosts already have this." },
} as const;

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const vendorProfileSchema = z.object({
  business_name: z.string().trim().min(2, "Enter your business name (at least 2 characters)").max(120),
  business_type: z.enum(BUSINESS_TYPES.map((b) => b.value) as [string, ...string[]], { error: "Choose a business type" }),
  description: text(2000),
  contact_name: z.string().trim().min(2, "Enter a contact name").max(120),
  contact_email: optionalEmail.refine((v) => v !== undefined, "Enter a contact email"),
  contact_phone: optionalPhone.refine((v) => v !== undefined, "Enter a contact phone number"),
  address_line: z.string().trim().min(3, "Enter the business address").max(300),
  city: z.string().trim().min(2, "Enter a city").max(120),
  state: z.string().trim().min(2, "Enter a state").max(120),
  postal_code: z.string().trim().regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code"),
  tax_identifier: text(40),
});
export type VendorProfileInput = z.infer<typeof vendorProfileSchema>;

/** A lenient version for saving a draft: blanks are allowed, formats are not. */
export const vendorDraftSchema = z.object({
  business_name: z.string().trim().min(2, "Enter your business name (at least 2 characters)").max(120),
  business_type: z.preprocess((v) => (v === "" ? undefined : v), z.enum(BUSINESS_TYPES.map((b) => b.value) as [string, ...string[]]).optional()),
  description: text(2000),
  contact_name: text(120),
  contact_email: optionalEmail,
  contact_phone: optionalPhone,
  address_line: text(300),
  city: text(120),
  state: text(120),
  postal_code: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code").optional()),
  tax_identifier: text(40),
});

export const submitSchema = z.object({
  capabilities: z.array(z.enum(["products", "services", "stays"])).min(1, "Choose at least one"),
});

/** "560078, 562 560001\n" -> unique, valid codes; invalid tokens are reported, not silently dropped. */
export function parsePinList(raw: string): { codes: string[]; invalid: string[] } {
  const tokens = raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const codes = new Set<string>();
  const invalid: string[] = [];
  for (const t of tokens) {
    if (/^\d{6}$/.test(t) || /^\d{3}$/.test(t)) codes.add(t);
    else invalid.push(t);
  }
  return { codes: [...codes], invalid };
}

export const DOC_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
