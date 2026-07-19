"use server";

import { enquirySchema, type EnquiryInput } from "@/lib/enquiry-schema";

export interface EnquiryResult {
  success: boolean;
  error?: string;
}

export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  // NOTE: no email/CRM provider is wired up yet. Wire this to a transactional
  // email service (Resend, Postmark) or CRM webhook before going live.
  console.log("New Hasiru Nidhi enquiry:", parsed.data);

  return { success: true };
}
