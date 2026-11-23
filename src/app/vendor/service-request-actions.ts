"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { cancelRequestSchema, istLocalToIso, quotationSchema, respondSchema, scheduleSchema } from "@/lib/validation/service";

async function provider() {
  const s = await getSession();
  return s && !s.profile.is_suspended && s.profile.role !== "admin" ? s : null;
}
const DENIED: FormState = { ok: false, message: "Please sign in to continue." };
const done = (id: string) => { revalidatePath("/vendor/service-requests"); revalidatePath(`/vendor/service-requests/${id}`); };
const UUID = /^[0-9a-f-]{36}$/;

/** Accept (fixed-price only) or decline a request. The database checks that it belongs to this provider and is still waiting. */
export async function respondServiceRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = respondSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose accept or decline.", values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("provider_respond_service_request", { p_request: parsed.data.request_id, p_decision: parsed.data.decision, p_reason: parsed.data.reason || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.request_id);
  return { ok: true, message: parsed.data.decision === "accept" ? "Request accepted. The customer's phone and address are now visible below." : "Request declined." };
}

export async function sendQuotation(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = quotationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const start = parsed.data.proposed_start ? istLocalToIso(parsed.data.proposed_start) : null;
  if (parsed.data.proposed_start && !start) return { ok: false, message: "Choose a valid proposed date and time, or leave it blank.", values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const d = parsed.data;
  const { error } = await session.supabase.rpc("provider_send_quotation", {
    p_request: d.request_id,
    p: { amount_inr: d.amount_inr, description: d.description, valid_until: d.valid_until, proposed_start: start, proposed_duration_minutes: d.proposed_duration_minutes ?? null },
  });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(d.request_id);
  return { ok: true, message: "Quotation sent. The customer can now accept or decline it.", values: {} };
}

export async function scheduleAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose a date and time.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("provider_schedule_appointment", { p_request: parsed.data.request_id, p_start: istLocalToIso(parsed.data.start), p_duration: parsed.data.duration ?? null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.request_id);
  return { ok: true, message: "Appointment scheduled. The customer has been told.", values: {} };
}

export async function startService(requestId: string): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  if (!UUID.test(requestId)) return { ok: false, message: "Unknown request." };
  const { error } = await session.supabase.rpc("provider_start_service", { p_request: requestId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  done(requestId);
  return { ok: true, message: "Marked as in progress." };
}

export async function completeService(requestId: string): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  if (!UUID.test(requestId)) return { ok: false, message: "Unknown request." };
  const { error } = await session.supabase.rpc("provider_complete_service", { p_request: requestId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  done(requestId);
  return { ok: true, message: "Marked as completed. Payment is not configured, so it stays unpaid until you arrange it with the customer." };
}

export async function cancelByProvider(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = cancelRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please reload and try again.", values: raw };
  const { error } = await session.supabase.rpc("provider_cancel_service_request", { p_request: parsed.data.request_id, p_reason: parsed.data.reason });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.request_id);
  return { ok: true, message: "Request cancelled. The customer and our team have been told." };
}
