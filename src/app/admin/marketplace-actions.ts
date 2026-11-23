"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { FLAG_KEYS } from "@/lib/flags";
import { slugify } from "@/lib/validation/property";

const DENIED: FormState = { ok: false, message: "Administrator access is required." };

async function adminSession() {
  try {
    return await assertRole(["admin"]);
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const vendorDecision = z.object({
  vendor_id: z.uuid(),
  decision: z.enum(["start_review", "approve", "reject", "suspend", "reinstate"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function reviewVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = vendorDecision.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Choose a decision.", values: raw };
  const { vendor_id, decision, reason } = parsed.data;
  const { error } = await session.supabase.rpc("admin_review_vendor", { p_vendor: vendor_id, p_decision: decision, p_reason: reason ?? null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${vendor_id}`);
  return { ok: true, message: "Decision recorded." };
}

const capabilityDecision = z.object({
  vendor_id: z.uuid(),
  capability: z.enum(["products", "services", "stays"]),
  decision: z.enum(["approve", "reject", "suspend", "reinstate"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function reviewCapability(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = capabilityDecision.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Choose a decision.", values: raw };
  const { vendor_id, capability, decision, reason } = parsed.data;
  const { error } = await session.supabase.rpc("admin_review_capability", { p_vendor: vendor_id, p_capability: capability, p_decision: decision, p_reason: reason ?? null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/admin/vendors");
  revalidatePath(`/admin/vendors/${vendor_id}`);
  return { ok: true, message: "Decision recorded." };
}

const documentDecision = z.object({ document_id: z.uuid(), vendor_id: z.uuid(), decision: z.enum(["accept", "reject"]), note: z.string().trim().max(1000).optional() });

export async function reviewVendorDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = documentDecision.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose a decision.", values: raw };
  const { document_id, vendor_id, decision, note } = parsed.data;
  const { error } = await session.supabase.rpc("admin_review_vendor_document", { p_document: document_id, p_decision: decision, p_note: note ?? null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath(`/admin/vendors/${vendor_id}`);
  return { ok: true, message: decision === "accept" ? "Document accepted." : "Document rejected; the vendor has been told why." };
}

/** Turns a module ON or OFF. Each change is written to the audit log by the settings trigger. */
export async function setMarketplaceFlag(key: string, value: boolean): Promise<void> {
  const session = await adminSession();
  if (!session || !Object.values(FLAG_KEYS).includes(key as (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS])) return;
  await session.supabase.from("platform_settings").update({ value, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq("key", key);
  revalidatePath("/admin/marketplace");
  revalidatePath("/", "layout");
}

const requirementSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  description: z.string().trim().max(500).optional(),
  capability: z.enum(["products", "services", "stays"]),
  is_required: z.enum(["true", "false"]),
});

export async function addDocumentRequirement(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = requirementSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Please fix the highlighted fields.", values: formValues(formData) };
  const d = parsed.data;
  const slug = `${slugify(d.name)}-${d.capability}`.slice(0, 80);
  const { error } = await session.supabase.from("vendor_document_requirements").insert({ slug, name: d.name, description: d.description || null, capability: d.capability, is_required: d.is_required === "true" });
  if (error) return { ok: false, message: error.code === "23505" ? "A requirement with that name already exists for this capability." : friendlyDbError(error) };
  revalidatePath("/admin/marketplace");
  return { ok: true, message: "Requirement added." };
}

export async function setRequirementActive(id: number, active: boolean): Promise<void> {
  const session = await adminSession();
  if (!session) return;
  await session.supabase.from("vendor_document_requirements").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/marketplace");
}

const commissionSchema = z.object({
  vertical: z.enum(["products", "services"]),
  category_id: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().positive().nullable()),
  rate: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0, "At least 0").max(50, "At most 50").nullable()),
  note: z.string().trim().min(3, "Say who approved this rate and why").max(500),
});

/** Records a commission rate (or marks it unconfigured when the rate is blank). Append-only: the history is kept. */
export async function setMarketplaceCommission(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = commissionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const { error } = await session.supabase.rpc("admin_set_marketplace_commission", { p_vertical: parsed.data.vertical, p_category: parsed.data.category_id, p_rate: parsed.data.rate, p_note: parsed.data.note });
  if (error) return { ok: false, message: error.message.includes("invalid_rate") ? "The rate must be between 0 and 50, with at most two decimals." : friendlyDbError(error), values: raw };
  revalidatePath("/admin/marketplace-commission");
  return { ok: true, message: parsed.data.rate === null ? "Recorded as unconfigured." : "Rate recorded. Nothing is charged yet: payment is not configured.", values: {} };
}
