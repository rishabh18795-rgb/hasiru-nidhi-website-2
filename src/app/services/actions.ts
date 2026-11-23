"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { istLocalToIso, serviceRequestSchema } from "@/lib/validation/service";

export interface CoverageResult { ok: boolean; status?: "yes" | "no" | "unknown"; message: string }

/** Public question: does this provider serve this PIN code? Only ever answers yes / no / unknown. */
export async function checkCoverage(serviceId: string, pin: string): Promise<CoverageResult> {
  if (!/^[0-9a-f-]{36}$/.test(serviceId)) return { ok: false, message: "Unknown service." };
  if (!/^\d{6}$/.test(pin)) return { ok: false, message: "Enter a valid 6-digit PIN code." };
  if (!isSupabaseConfigured()) return { ok: false, message: "We couldn't check that right now. Please try again." };
  if (!(await withinRateLimit("coverageCheck"))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { data, error } = await createPublicSupabase(0).rpc("check_service_coverage", { p_service: serviceId, p_pin: pin });
  if (error) return { ok: false, message: "We couldn't check that right now. Please try again." };
  if (data === "yes") return { ok: true, status: "yes", message: "Good news: this provider serves your PIN code." };
  if (data === "no") return { ok: true, status: "no", message: "Sorry, this provider does not serve that PIN code." };
  return { ok: true, status: "unknown", message: "This provider has not listed the areas they serve yet. You can still send a request and they will tell you." };
}

export async function submitServiceRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session || session.profile.is_suspended) return { ok: false, message: "Please sign in to send a request." };
  const raw = formValues(formData);
  const parsed = serviceRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const d = parsed.data;
  const preferred = d.preferred ? (d.preferred.length > 16 ? d.preferred : istLocalToIso(d.preferred)) : null;
  if (d.preferred && !preferred) return { ok: false, message: "Choose a valid preferred date and time, or leave it blank.", values: raw };
  if (!(await withinRateLimit("serviceRequest", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { data, error } = await session.supabase.rpc("request_service", {
    p: { service_id: d.service_id, quantity: d.quantity, customer_name: d.customer_name, phone: d.phone, address_line: d.address_line, city: d.city, pin: d.pin,
         property_type: d.property_type, site_size: d.site_size, details: d.details, preferred_start: preferred },
    p_key: d.key,
  });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/dashboard/requests");
  return { ok: true, message: `REQUEST:${data}`, values: {} };
}
