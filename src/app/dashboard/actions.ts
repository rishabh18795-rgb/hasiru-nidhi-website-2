"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { cancelSchema, reviewSchema } from "@/lib/validation/booking";
import { profileSchema } from "@/lib/validation/auth";
import { bookingEmails, emailUser } from "@/lib/notifications";
import { formatDate } from "@/lib/format";

const SIGN_IN: FormState = { ok: false, message: "Please sign in again to continue." };

export async function cancelMyBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGN_IN;
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };

  const { data: booking } = await session.supabase.from("bookings").select("property_id, property_name, check_in, check_out").eq("id", parsed.data.booking_id).maybeSingle();
  const { error } = await session.supabase.rpc("cancel_booking", { p_booking: parsed.data.booking_id, p_note: parsed.data.note ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };

  if (booking) {
    const { data: prop } = await session.supabase.from("properties").select("host_id").eq("id", booking.property_id).maybeSingle();
    const mail = bookingEmails.cancelled({ property: booking.property_name, checkIn: formatDate(booking.check_in), checkOut: formatDate(booking.check_out), by: "guest" });
    await emailUser(prop?.host_id, mail.subject, mail.body);
  }
  revalidatePath("/dashboard/bookings");
  revalidatePath("/host/bookings");
  return { ok: true, message: "Booking cancelled. Any refund follows the cancellation policy shown on this booking." };
}

export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGN_IN;
  const values = formValues(formData);
  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };

  // The insert is checked by RLS: only the guest of a finished, confirmed stay may review it, once.
  const { data: booking } = await session.supabase.from("bookings").select("property_id").eq("id", parsed.data.booking_id).maybeSingle();
  if (!booking) return { ok: false, message: "We couldn't find that stay." };
  const { error } = await session.supabase.from("reviews").insert({
    booking_id: parsed.data.booking_id,
    property_id: booking.property_id,
    traveller_id: session.user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return { ok: false, message: dup ? "You've already reviewed this stay." : "You can review a stay only after it has finished.", values };
  }
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: "Thank you for your review." };
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGN_IN;
  const values = formValues(formData);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const { error } = await session.supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone ?? null })
    .eq("id", session.user.id);
  if (error) return { ok: false, message: "We couldn't save your profile. Please try again.", values };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await session.supabase.from("notifications").update({ is_read: true }).eq("user_id", session.user.id).eq("is_read", false);
  revalidatePath("/dashboard/notifications");
}

export async function removeSaved(propertyId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await session.supabase.from("saved_properties").delete().eq("user_id", session.user.id).eq("property_id", propertyId);
  revalidatePath("/dashboard/saved");
}
