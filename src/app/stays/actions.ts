"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { stayRequestSchema } from "@/lib/validation/booking";
import { contactEnquirySchema, reportSchema } from "@/lib/validation/enquiries";
import { recordEnquiry } from "@/lib/data/enquiries";
import { bookingEmails, emailUser } from "@/lib/notifications";
import { formatDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { adminNotifyEmail, sendEmail } from "@/lib/email";

const NOT_CONFIGURED: FormState = { ok: false, message: "Bookings aren't available yet: the booking service hasn't been connected to this deployment." };

/**
 * Creates a booking REQUEST. All availability, capacity and date rules are enforced inside the
 * database function request_booking() — this action only authenticates, validates shape, and reports.
 * Nothing here ever claims the stay is confirmed.
 */
export async function requestStay(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in to send a booking request." };
  if (session.profile.is_suspended) return { ok: false, message: friendlyDbError({ message: "account_suspended" }) };

  const values = formValues(formData);
  const parsed = stayRequestSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const v = parsed.data;

  const { data, error } = await session.supabase.rpc("request_booking", {
    p_property: v.property_id,
    p_check_in: v.check_in,
    p_check_out: v.check_out,
    p_adults: v.adults,
    p_children: v.children,
    p_message: v.message ?? null,
  });
  if (error) return { ok: false, message: friendlyDbError(error), values };

  // Best-effort e-mail layer (the in-app notifications were already written by the database).
  const { data: prop } = await session.supabase.from("properties").select("name, host_id").eq("id", v.property_id).maybeSingle();
  if (prop) {
    const dates = { checkIn: formatDate(v.check_in), checkOut: formatDate(v.check_out) };
    const hostMail = bookingEmails.requestedHost({ property: prop.name, guest: session.profile.full_name || "A guest", guests: v.adults + v.children, ...dates });
    await emailUser(prop.host_id, hostMail.subject, hostMail.body);
    const guestMail = bookingEmails.requestedGuest({ property: prop.name, ...dates });
    await emailUser(session.user.id, guestMail.subject, guestMail.body, session.profile.email);
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/host/bookings");
  return { ok: true, message: `Request sent. It is NOT confirmed yet — the host will review it and you'll be notified of their decision. (Reference ${String(data).slice(0, 8).toUpperCase()})` };
}

export async function toggleSaved(propertyId: string, slug: string): Promise<void> {
  const session = await getSession();
  if (!session || !/^[0-9a-f-]{36}$/.test(propertyId)) return;
  const { data: existing } = await session.supabase
    .from("saved_properties").select("property_id").eq("user_id", session.user.id).eq("property_id", propertyId).maybeSingle();
  if (existing) {
    await session.supabase.from("saved_properties").delete().eq("user_id", session.user.id).eq("property_id", propertyId);
  } else {
    await session.supabase.from("saved_properties").insert({ user_id: session.user.id, property_id: propertyId });
  }
  revalidatePath(`/stays/${slug}`);
  revalidatePath("/dashboard/saved");
}

export async function reportListing(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const values = formValues(formData);
  const parsed = reportSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const session = await getSession();
  const supabase = session?.supabase ?? (await (await import("@/lib/supabase/server")).createServerSupabase());
  const { error } = await supabase.from("reports").insert({ ...parsed.data, reporter_id: session?.user.id ?? null });
  if (error) return { ok: false, message: "We couldn't submit your report. The listing may no longer be available.", values };
  const to = adminNotifyEmail();
  if (to) await sendEmail({ to, subject: "A listing was reported", text: `Reason: ${parsed.data.reason}\n\nReview it in Admin > Reports.` });
  return { ok: true, message: "Thank you — our team will review this listing." };
}

export async function contactAboutProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  if (values.website) return { ok: true, message: "Message sent." };
  const parsed = contactEnquirySchema.safeParse({ ...values, kind: "property" });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const v = parsed.data;
  const result = await recordEnquiry(
    "contact_enquiries",
    { kind: "property", name: v.name, email: v.email ?? null, phone: v.phone ?? null, subject: v.subject ?? "Property enquiry", message: v.message, property_id: v.property_id ?? null },
    `New property enquiry from ${v.name}`,
    `${v.message}\n\nFrom: ${v.name} ${v.email ?? ""} ${v.phone ?? ""}\nManage in Admin > Enquiries.`,
  );
  return result.ok
    ? { ok: true, message: "Message sent. The team and the host will get back to you." }
    : { ok: false, message: result.error, values };
}
