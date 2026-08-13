import { bookingSchema, type BookingInput } from "@/lib/booking-schema";

export interface BookingResult {
  success: boolean;
  error?: string;
}

// Static export (GitHub Pages) — no server to run this on, so it's a plain
// client-callable function. Wire it to a transactional email service
// (Resend, Postmark) or a form backend (Formspree, etc.) before launch.
export async function submitBooking(input: BookingInput): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  console.log("New Hasiru Nidhi booking request:", parsed.data);

  return { success: true };
}
