import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { adminNotifyEmail, sendEmail } from "@/lib/email";
import { getSession } from "@/lib/auth";
import { getPublicSettings } from "@/lib/data/catalog";
import { whatsappLink } from "@/lib/contact";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";

export const BACKEND_NOT_CONFIGURED =
  "Our online forms are being connected and can't accept submissions yet. Please check back shortly.";

/** A friendlier not-configured message that points at a real channel only when one exists. */
export async function backendUnavailableMessage(): Promise<string> {
  const settings = await getPublicSettings();
  const wa = whatsappLink(settings.whatsapp_number);
  if (wa) return `Our online forms are being connected and can't accept submissions yet. Please message us on WhatsApp: ${wa}`;
  if (settings.support_email) return `Our online forms are being connected and can't accept submissions yet. Please email ${settings.support_email}.`;
  return BACKEND_NOT_CONFIGURED;
}

type EnquiryTable = "contact_enquiries" | "partner_applications" | "gardening_enquiries";

export interface RecordResult {
  ok: boolean;
  error?: string;
  emailStatus?: string;
}

/**
 * Persists a public enquiry/application through the caller's own (anon or signed-in) Supabase
 * client — Row Level Security validates the row — then best-effort e-mails the admin.
 * Returns ok=false (never a fake success) when the row could not be stored.
 */
export async function recordEnquiry(
  table: EnquiryTable,
  row: Record<string, unknown>,
  adminSubject: string,
  adminBody: string,
): Promise<RecordResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: await backendUnavailableMessage() };
  try {
    const supabase = await createServerSupabase();
    const session = await getSession();
    if (!(await withinRateLimit("enquiry", session?.user.id))) return { ok: false, error: RATE_LIMITED_MESSAGE };
    const { error } = await supabase.from(table).insert({ ...row, user_id: session?.user.id ?? null });
    if (error) {
      console.error(`recordEnquiry(${table}) failed`, error.message);
      return { ok: false, error: "We couldn't save your submission. Please check your details and try again." };
    }
    const to = adminNotifyEmail();
    const email = to ? await sendEmail({ to, subject: adminSubject, text: adminBody }) : { status: "skipped_not_configured" as const };
    return { ok: true, emailStatus: email.status };
  } catch (err) {
    console.error(`recordEnquiry(${table}) threw`, err);
    return { ok: false, error: "Something went wrong while saving your submission. Please try again." };
  }
}
