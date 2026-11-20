"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { decisionSchema, policySchema } from "@/lib/validation/order";

const DENIED: FormState = { ok: false, message: "Administrator access is required." };
async function adminSession() {
  try { return await assertRole(["admin"]); } catch (e) { if (e instanceof AuthorizationError) return null; throw e; }
}
const refresh = (orderId?: string) => { revalidatePath("/admin/orders"); if (orderId) revalidatePath(`/admin/orders/${orderId}`); };

const cancelSchema = z.object({ order_id: z.uuid(), reason: z.string().trim().min(3, "Enter a reason").max(500) });
export async function adminCancelOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Enter a reason for the cancellation.", fieldErrors: zodFieldErrors(parsed.error) };
  const { error } = await session.supabase.rpc("admin_cancel_order", { p_order: parsed.data.order_id, p_reason: parsed.data.reason });
  if (error) return { ok: false, message: friendlyDbError(error) };
  refresh(parsed.data.order_id);
  return { ok: true, message: "Order cancelled and stock returned." };
}

export async function adminDecideRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = decisionSchema.safeParse({ id: raw.request_id, decision: raw.decision, note: raw.note });
  if (!parsed.success) return { ok: false, message: "Choose a decision.", values: raw };
  const { error } = await session.supabase.rpc("decide_order_request", { p_request: parsed.data.id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  refresh(raw.order_id);
  return { ok: true, message: "Decision recorded." };
}

const disputeSchema = z.object({ dispute_id: z.uuid(), order_id: z.uuid().optional(), status: z.enum(["in_review", "resolved", "dismissed"]), resolution: z.preprocess((v) => v ?? "", z.string().trim().max(2000)) });
export async function resolveDispute(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = disputeSchema.safeParse({ ...raw, order_id: raw.order_id || undefined });
  if (!parsed.success) return { ok: false, message: "Choose a status.", values: raw };
  const { error } = await session.supabase.rpc("admin_resolve_dispute", { p_dispute: parsed.data.dispute_id, p_status: parsed.data.status, p_resolution: parsed.data.resolution || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  refresh(parsed.data.order_id);
  return { ok: true, message: "Dispute updated." };
}

const tri = (v: string) => (v === "true" ? true : v === "false" ? false : null);
export async function savePolicy(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Windows must be whole numbers of days (1 to 365).", fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  const { error } = await session.supabase.from("product_category_policies").upsert({
    category_id: d.category_id, returns_allowed: tri(d.returns_allowed), return_window_days: d.return_window_days ?? null, replacements_allowed: tri(d.replacements_allowed),
    replacement_window_days: d.replacement_window_days ?? null, notes: d.notes || null, updated_by: session.user.id, updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/admin/order-policies");
  revalidatePath("/shop", "layout"); // product pages show the policy, so refresh them now rather than after the short cache
  return { ok: true, message: "Policy saved." };
}
