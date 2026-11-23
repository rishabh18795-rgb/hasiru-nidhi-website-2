"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { cancelRequestSchema, decideQuotationSchema } from "@/lib/validation/service";

async function customer() {
  const s = await getSession();
  return s && !s.profile.is_suspended ? s : null;
}
const DENIED: FormState = { ok: false, message: "Please sign in to continue." };
const done = (id: string) => { revalidatePath("/dashboard/requests"); revalidatePath(`/dashboard/requests/${id}`); };

export async function cancelServiceRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customer();
  if (!session) return DENIED;
  const parsed = cancelRequestSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please reload and try again." };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { error } = await session.supabase.rpc("cancel_service_request", { p_request: parsed.data.request_id, p_reason: parsed.data.reason || null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  done(parsed.data.request_id);
  return { ok: true, message: "Your request was cancelled." };
}

export async function decideQuotation(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customer();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = decideQuotationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Choose accept or decline.", values: raw };
  if (!(await withinRateLimit("orderAction", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("decide_quotation", { p_quotation: parsed.data.quotation_id, p_decision: parsed.data.decision, p_note: parsed.data.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  done(parsed.data.request_id);
  return { ok: true, message: parsed.data.decision === "accept" ? "Quotation accepted. The provider now has your phone and address. It is unpaid: payment is not configured yet." : "Quotation declined. The provider can send a revised one." };
}
