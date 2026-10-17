"use server";

import { bookingSchema, experienceTypes, stayTypes, type BookingInput } from "@/lib/booking-schema";
import { recordEnquiry } from "@/lib/data/enquiries";

export interface BookingResult {
  success: boolean;
  error?: string;
}

const label = <T extends { value: string; label: string }>(list: readonly T[], value?: string) =>
  list.find((i) => i.value === value)?.label ?? value ?? "";

/**
 * "Request Availability" for Hasiru Nidhi's own experiences. This is an enquiry, NOT a reservation:
 * it is stored for the team to answer. Real reservations on listed properties go through
 * /stays/[slug] and the booking-request workflow.
 */
export async function submitBooking(input: BookingInput): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Please check the form and try again." };
  const v = parsed.data;
  if (v.website) return { success: true };

  const experience = label(experienceTypes, v.experienceType);
  const payload = {
    experience,
    stay_type: v.stayType ? label(stayTypes, v.stayType) : undefined,
    preferred_date: v.preferredDate,
    adults: v.adults,
    children: v.children || "0",
    project_type: v.projectType || undefined,
    project_location: v.projectLocation || undefined,
    project_size: v.projectSize || undefined,
  };

  const result = await recordEnquiry(
    "contact_enquiries",
    {
      kind: "experience_request",
      name: v.fullName.trim(),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.replace(/[\s()-]/g, ""),
      subject: `${experience} — ${v.preferredDate}`,
      message: (v.message ?? "").trim() || `Availability request for ${experience}.`,
      payload,
    },
    `New availability request: ${experience}`,
    `Name: ${v.fullName}\nEmail: ${v.email}\nPhone: ${v.phone}\nExperience: ${experience}\nDate: ${v.preferredDate}\nGuests: ${v.adults} adults, ${v.children || 0} children\n\n${v.message ?? ""}\n\nManage it in Admin > Enquiries.`,
  );
  return result.ok ? { success: true } : { success: false, error: result.error };
}
