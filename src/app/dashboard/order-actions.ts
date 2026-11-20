"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { cancelSchema, disputeSchema, returnSchema } from "@/lib/validation/order";

async function customer() {
  const s = await getSession();
  return s && !s.profile.is_suspended ? s : null;
}
const DENIED: FormState = { ok: false, message: "Please sign in to continue." };

export async function cancelOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customer();
  if (!session) return DENIED;
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please reload and try again." };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { data, error } = await session.supabase.rpc("cancel_order", { p_order: parsed.data.order_id, p_reason: parsed.data.reason || null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/dashboard/orders/${parsed.data.order_id}`);
  revalidatePath("/dashboard/orders");
  return { ok: true, message: data === "cancelled" ? "Your order was cancelled." : "Your cancellation request was sent to the seller. The order stays active until they decide." };
}

export async function requestReturn(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customer();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = returnSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("request_return", { p_order: parsed.data.order_id, p_kind: parsed.data.kind, p_reason: parsed.data.reason, p_details: parsed.data.details || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath(`/dashboard/orders/${parsed.data.order_id}`);
  return { ok: true, message: `Your ${parsed.data.kind} request was sent. The seller and our team will review it.`, values: {} };
}

export async function openDispute(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customer();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = disputeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("open_dispute", { p_order: parsed.data.order_id, p_description: parsed.data.description });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath(`/dashboard/orders/${parsed.data.order_id}`);
  return { ok: true, message: "Your concern was sent to our team. We will look into it.", values: {} };
}
