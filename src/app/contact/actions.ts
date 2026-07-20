import { enquirySchema, type EnquiryInput } from "@/lib/enquiry-schema";

export interface EnquiryResult {
  success: boolean;
  error?: string;
}

// This site is statically exported for GitHub Pages, which serves files
// only — there is no server to run a Next.js Server Action. This runs
// entirely in the browser. Wire it to a transactional email service
// (Resend, Postmark) or a form backend (Formspree, etc.) before launch.
export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  console.log("New Hasiru Nidhi enquiry:", parsed.data);

  return { success: true };
}
