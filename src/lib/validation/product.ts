import { z } from "zod";

import type { ProductAttribute } from "@/lib/db/types";

const blank = (v: unknown) => (v === undefined || v === null ? "" : v);

/** "Height: 20 cm" per line -> [{label, value}]. Lines without a colon are reported, not guessed at. */
export function parseLabelLines(raw: string, max: number): { items: { label: string; value: string }[]; errors: string[] } {
  const items: { label: string; value: string }[] = [];
  const errors: string[] = [];
  for (const line of raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const i = line.indexOf(":");
    const label = i > 0 ? line.slice(0, i).trim() : "";
    const value = i > 0 ? line.slice(i + 1).trim() : "";
    if (!label || !value) errors.push(`"${line.slice(0, 40)}" needs a label and a value, like "Height: 20 cm"`);
    else if (label.length > 60 || value.length > 200) errors.push(`"${line.slice(0, 40)}" is too long`);
    else items.push({ label, value });
  }
  if (items.length > max) errors.push(`Use at most ${max} lines`);
  return { items: items.slice(0, max), errors };
}

export const attributesToText = (a: ProductAttribute[] | null | undefined) => (a ?? []).map((x) => `${x.label}: ${x.value}`).join("\n");
export const optionsToText = (o: Record<string, string> | null | undefined) => Object.entries(o ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n");

export const productSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  name: z.string().trim().min(3, "Enter a product name (at least 3 characters)").max(120),
  category_id: z.coerce.number({ error: "Choose a category" }).int().positive("Choose a category"),
  summary: z.preprocess(blank, z.string().trim().max(240, "Keep the summary under 240 characters")),
  description: z.preprocess(blank, z.string().trim().max(8000)),
  brand: z.preprocess(blank, z.string().trim().max(80)),
  specifications: z.preprocess(blank, z.string().max(6000)),
});

export const variantSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  product_id: z.uuid(),
  sku: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, "Use letters, numbers, dots, dashes or underscores (up to 40)"),
  name: z.string().trim().min(1, "Enter a variant name, e.g. 250 g pack").max(120),
  options: z.preprocess(blank, z.string().max(1000)),
  price_inr: z.coerce.number({ error: "Enter a price" }).min(0.01, "Enter a price of at least ₹0.01").max(10000000),
  weight_grams: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().positive().max(1000000).optional()),
  initial_stock: z.preprocess((v) => (v === "" || v === undefined ? 0 : v), z.coerce.number().int().min(0).max(1000000)),
  track_inventory: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  is_active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const adjustSchema = z.object({
  variant_id: z.uuid(),
  mode: z.enum(["set", "add"]),
  quantity: z.coerce.number({ error: "Enter a quantity" }).int("Whole numbers only").min(-1000000).max(1000000),
  reason: z.enum(["restock", "correction", "damaged", "returned_to_stock", "other"]),
  note: z.preprocess(blank, z.string().trim().max(300)),
});

export const INVENTORY_REASONS: Record<string, string> = {
  initial: "Opening stock", restock: "Restock", correction: "Stock count correction", damaged: "Damaged or lost", returned_to_stock: "Returned to stock", other: "Other",
};

export const PRODUCT_STATUS_COPY: Record<string, string> = {
  draft: "Draft: only you can see it. Complete it and submit for review.",
  pending_review: "Waiting for our team to review it. You can't edit it until the review is finished.",
  approved: "Approved and live when the Shop is open. Changing its details or photos sends it back for review.",
  rejected: "Not approved. Read the note, fix it and submit again.",
  suspended: "Suspended by our team. Contact support to resolve this.",
  archived: "Archived: hidden from shoppers. Restore it to start again as a draft.",
};
