"use server";

import { enquirySchema, type EnquiryInput } from "@/lib/enquiry-schema";
import { recordEnquiry } from "@/lib/data/enquiries";

export interface EnquiryResult {
  success: boolean;
  error?: string;
}

const SUBJECT_KIND: Record<string, string> = {
  "Corporate/Group visit": "group",
  Partnership: "host_partnership",
};

/** General (non-booking) enquiries from the Contact page. Persisted in contact_enquiries. */
export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Please check the form and try again." };
  const v = parsed.data;
  // Hidden spam trap: silently accept, store nothing.
  if (v.website) return { success: true };

  const result = await recordEnquiry(
    "contact_enquiries",
    {
      kind: SUBJECT_KIND[v.subject] ?? "general",
      name: v.name.trim(),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.replace(/[\s()-]/g, ""),
      subject: v.subject,
      message: v.message.trim(),
    },
    `New website enquiry from ${v.name.trim()}`,
    `Subject: ${v.subject}\nName: ${v.name}\nEmail: ${v.email}\nPhone: ${v.phone}\n\n${v.message}\n\nManage it in Admin > Enquiries.`,
  );
  return result.ok ? { success: true } : { success: false, error: result.error };
}
