import "server-only";

import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { sendEmail, type EmailResult } from "@/lib/email";
import { siteConfig } from "@/lib/site";

/**
 * In-app notifications are written by the database inside each workflow. E-mails are an extra,
 * best-effort layer: they need an e-mail provider AND the service role (to look up the OTHER
 * party's address, which row-level security rightly hides). When either is missing the e-mail is
 * skipped and the result says so — the in-app notification still exists.
 */
export async function lookupEmail(userId: string | null | undefined): Promise<string | null> {
  if (!userId || !isServiceRoleConfigured()) return null;
  try {
    const { data } = await createAdminSupabase().from("profiles").select("email").eq("id", userId).maybeSingle();
    return (data?.email as string | null) ?? null;
  } catch {
    return null;
  }
}

function footer(): string {
  return `\n\n— ${siteConfig.legalName}\n${siteConfig.url}`;
}

export async function emailUser(userId: string | null | undefined, subject: string, body: string, knownEmail?: string | null): Promise<EmailResult> {
  const to = knownEmail ?? (await lookupEmail(userId));
  if (!to) return { status: "skipped_not_configured" };
  return sendEmail({ to, subject, text: body + footer() });
}

export const bookingEmails = {
  requestedHost: (v: { property: string; guest: string; checkIn: string; checkOut: string; guests: number }) => ({
    subject: `New booking request — ${v.property}`,
    body: `${v.guest} has requested ${v.property} from ${v.checkIn} to ${v.checkOut} for ${v.guests} guest(s).\n\nThis is a request, not a confirmed booking. Review and accept or decline it in your host dashboard: ${siteConfig.url}/host/bookings`,
  }),
  requestedGuest: (v: { property: string; checkIn: string; checkOut: string }) => ({
    subject: `Your request for ${v.property}`,
    body: `We've sent your request for ${v.property} (${v.checkIn} to ${v.checkOut}) to the host.\n\nIt is NOT a confirmed reservation yet. You'll be notified as soon as the host responds. Track it here: ${siteConfig.url}/dashboard/bookings`,
  }),
  decisionGuest: (v: { property: string; accepted: boolean; checkIn: string; checkOut: string; note?: string }) => ({
    subject: v.accepted ? `Booking confirmed — ${v.property}` : `Booking request declined — ${v.property}`,
    body: v.accepted
      ? `Good news: the host has confirmed ${v.property} for ${v.checkIn} to ${v.checkOut}.${v.note ? `\n\nNote from the host: ${v.note}` : ""}\n\nDetails: ${siteConfig.url}/dashboard/bookings`
      : `Unfortunately the host couldn't accept your request for ${v.property} (${v.checkIn} to ${v.checkOut}).${v.note ? `\n\nNote from the host: ${v.note}` : ""}\n\nYou're welcome to try other dates or properties: ${siteConfig.url}/stays`,
  }),
  cancelled: (v: { property: string; checkIn: string; checkOut: string; by: "guest" | "host" }) => ({
    subject: `Booking cancelled — ${v.property}`,
    body: `The booking for ${v.property} (${v.checkIn} to ${v.checkOut}) was cancelled by the ${v.by}. Any refund follows the property's cancellation policy: ${siteConfig.url}/cancellation-policy`,
  }),
};

export const listingEmails = {
  submittedAdmin: (name: string) => ({
    subject: `Listing awaiting review — ${name}`,
    body: `A host has submitted "${name}" for review: ${siteConfig.url}/admin/properties`,
  }),
  decisionHost: (v: { name: string; decision: string; reason?: string }) => ({
    subject: `Your listing "${v.name}" was ${v.decision}`,
    body: `Your listing "${v.name}" is now: ${v.decision}.${v.reason ? `\n\nReason: ${v.reason}` : ""}\n\nManage it here: ${siteConfig.url}/host/properties`,
  }),
};
