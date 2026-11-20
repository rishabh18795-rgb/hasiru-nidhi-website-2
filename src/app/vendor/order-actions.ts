"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { decisionSchema, trackingSchema } from "@/lib/validation/order";

async function seller() {
  const s = await getSession();
  return s && !s.profile.is_suspended && s.profile.role !== "admin" ? s : null;
}
const DENIED: FormState = { ok: false, message: "Please sign in to continue." };
const done = (orderId: string) => { revalidatePath("/vendor/orders"); revalidatePath(`/vendor/orders/${orderId}`); };

const respondSchema = z.object({ order_id: z.uuid(), decision: z.enum(["accept", "reject"]), reason: z.preprocess((v) => v ?? "", z.string().trim().max(500)) });

/** Accept or reject an order request. The database checks that this order belongs to this seller and that it is still waiting. */
export async function respondOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = respondSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose accept or decline.", values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("vendor_respond_order", { p_order: parsed.data.order_id, p_decision: parsed.data.decision, p_reason: parsed.data.reason || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.order_id);
  return { ok: true, message: parsed.data.decision === "accept" ? "Order accepted. The customer's delivery details are now visible below." : "Order declined and stock returned." };
}

export async function markPacked(orderId: string): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return { ok: false, message: "Unknown order." };
  const { error } = await session.supabase.rpc("vendor_mark_packed", { p_order: orderId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  done(orderId);
  return { ok: true, message: "Marked as packed." };
}

export async function shipOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = trackingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const { error } = await session.supabase.rpc("vendor_ship_order", { p_order: parsed.data.order_id, p_carrier: parsed.data.carrier, p_tracking: parsed.data.tracking, p_url: parsed.data.url || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.order_id);
  return { ok: true, message: "Marked as shipped. The customer can see the tracking details.", values: {} };
}

const shipmentSchema = z.object({ order_id: z.uuid(), status: z.enum(["in_transit", "out_for_delivery", "delivered", "failed"]), note: z.preprocess((v) => v ?? "", z.string().trim().max(300)) });
export async function updateShipment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = shipmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose a shipment status.", values: raw };
  const { error } = await session.supabase.rpc("vendor_update_shipment", { p_order: parsed.data.order_id, p_status: parsed.data.status, p_note: parsed.data.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.order_id);
  return { ok: true, message: "Shipment updated." };
}

/** Approve, reject or complete a cancellation, return or replacement request on one of this seller's orders. */
export async function decideRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = decisionSchema.safeParse({ id: raw.request_id, decision: raw.decision, note: raw.note });
  if (!parsed.success) return { ok: false, message: "Choose a decision.", values: raw };
  const { error } = await session.supabase.rpc("decide_order_request", { p_request: parsed.data.id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  if (raw.order_id) done(raw.order_id);
  return { ok: true, message: "Decision recorded." };
}
