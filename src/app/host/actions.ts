"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { propertyFormSchema, roomTypeSchema, slugify } from "@/lib/validation/property";
import { availabilityBlockSchema, bookingResponseSchema, cancelSchema } from "@/lib/validation/booking";
import { adminNotifyEmail, sendEmail } from "@/lib/email";
import { bookingEmails, emailUser, listingEmails } from "@/lib/notifications";
import { formatDate } from "@/lib/format";

const DENIED: FormState = { ok: false, message: "You don't have permission to do that." };
const MAX_IMAGES = 12;

async function hostSession() {
  try {
    return await assertRole(["host"]);
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

function parseProperty(formData: FormData) {
  const values = formValues(formData);
  const parsed = propertyFormSchema.safeParse({
    ...values,
    amenity_ids: formData.getAll("amenity_ids").map(String),
    experience_ids: formData.getAll("experience_ids").map(String),
  });
  return { values, parsed };
}

/** Create (no id) or update (id) a listing. RLS + guard triggers decide what the host may actually change. */
export async function saveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const { values, parsed } = parseProperty(formData);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values };
  const v = parsed.data;
  const id = values.id || "";
  const { supabase, user } = session;

  const row = {
    name: v.name, category_id: v.category_id, summary: v.summary || null, description: v.description,
    city: v.city, state: v.state, region: v.region || null, postal_code: v.postal_code || null,
    rooms_count: v.rooms_count, max_guests: v.max_guests, price_inr: v.price_inr ?? null, price_unit: v.price_unit,
    check_in_time: v.check_in_time, check_out_time: v.check_out_time, house_rules: v.house_rules || null,
    cancellation_policy: v.cancellation_policy,
  };

  let propertyId = id;
  if (!id) {
    const slug = `${slugify(v.name)}-${randomUUID().slice(0, 6)}`;
    const { data, error } = await supabase
      .from("properties")
      .insert({ ...row, host_id: user.id, slug, status: "draft", terms_accepted_at: v.accept_terms ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: friendlyDbError(error), values };
    propertyId = data.id as string;
  } else {
    const { data: existing } = await supabase.from("properties").select("terms_accepted_at").eq("id", id).maybeSingle();
    if (!existing) return DENIED;
    const terms = v.accept_terms && !existing.terms_accepted_at ? { terms_accepted_at: new Date().toISOString() } : {};
    const { error } = await supabase.from("properties").update({ ...row, ...terms }).eq("id", id);
    if (error) return { ok: false, message: friendlyDbError(error), values };
  }

  const { error: privErr } = await supabase.from("property_private").upsert({
    property_id: propertyId, address_line: v.address_line || null, contact_name: v.contact_name || null,
    contact_email: v.contact_email ?? null, contact_phone: v.contact_phone ?? null,
    current_platforms: v.current_platforms || null, partnership_model: v.partnership_model || null,
  });
  if (privErr) return { ok: false, message: friendlyDbError(privErr), values };

  // Replace link rows. RLS only allows this for the property's owner.
  await supabase.from("property_amenities").delete().eq("property_id", propertyId);
  if (v.amenity_ids.length) await supabase.from("property_amenities").insert(v.amenity_ids.map((amenity_id) => ({ property_id: propertyId, amenity_id })));
  await supabase.from("property_experiences").delete().eq("property_id", propertyId);
  if (v.experience_ids.length) await supabase.from("property_experiences").insert(v.experience_ids.map((experience_id) => ({ property_id: propertyId, experience_id })));

  revalidatePath("/host/properties");
  if (!id) redirect(`/host/properties/${propertyId}?created=1`);
  return { ok: true, message: "Changes saved.", values };
}

export async function submitForReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const id = String(formData.get("property_id") ?? "");
  const { error } = await session.supabase.rpc("submit_property", { p_property: id });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const { data: p } = await session.supabase.from("properties").select("name").eq("id", id).maybeSingle();
  const to = adminNotifyEmail();
  if (to && p) {
    const mail = listingEmails.submittedAdmin(p.name);
    await sendEmail({ to, subject: mail.subject, text: mail.body });
  }
  revalidatePath("/host/properties");
  revalidatePath(`/host/properties/${id}`);
  return { ok: true, message: "Submitted for review. Your listing stays private until an administrator approves it." };
}

export async function deleteDraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const id = String(formData.get("property_id") ?? "");
  const { data, error } = await session.supabase.from("properties").delete().eq("id", id).eq("status", "draft").select("id");
  if (error || !data?.length) return { ok: false, message: "Only draft listings can be deleted." };
  const { data: files } = await session.supabase.storage.from("property-images").list(id);
  if (files?.length) await session.supabase.storage.from("property-images").remove(files.map((f) => `${id}/${f.name}`));
  revalidatePath("/host/properties");
  redirect("/host/properties?deleted=1");
}

/* -------------------------------------------------------------------- photos */
export async function registerPropertyImage(propertyId: string, path: string, alt: string): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  // The object must sit inside this property's own folder (storage policies enforce the same).
  if (!/^[0-9a-f-]{36}$/.test(propertyId) || !path.startsWith(`${propertyId}/`) || path.includes("..")) return { ok: false, message: "Invalid image path." };
  const { count } = await session.supabase.from("property_images").select("id", { count: "exact", head: true }).eq("property_id", propertyId);
  if ((count ?? 0) >= MAX_IMAGES) {
    await session.supabase.storage.from("property-images").remove([path]);
    return { ok: false, message: `You can upload up to ${MAX_IMAGES} photos per listing.` };
  }
  const { error } = await session.supabase.from("property_images").insert({ property_id: propertyId, path, source: "storage", alt: alt.slice(0, 200) || null, sort_order: count ?? 0 });
  if (error) {
    await session.supabase.storage.from("property-images").remove([path]);
    return { ok: false, message: friendlyDbError(error) };
  }
  revalidatePath(`/host/properties/${propertyId}`);
  return { ok: true };
}

export async function deletePropertyImage(imageId: string, propertyId: string): Promise<void> {
  const session = await hostSession();
  if (!session) return;
  const { data: img } = await session.supabase.from("property_images").select("path, source").eq("id", imageId).eq("property_id", propertyId).maybeSingle();
  if (!img) return;
  await session.supabase.from("property_images").delete().eq("id", imageId);
  if (img.source === "storage") await session.supabase.storage.from("property-images").remove([img.path]);
  revalidatePath(`/host/properties/${propertyId}`);
}

export async function makeCoverImage(imageId: string, propertyId: string): Promise<void> {
  const session = await hostSession();
  if (!session) return;
  const { data: imgs } = await session.supabase.from("property_images").select("id, sort_order").eq("property_id", propertyId).order("sort_order");
  if (!imgs) return;
  const ordered = [imageId, ...imgs.map((i) => i.id as string).filter((i) => i !== imageId)];
  for (let i = 0; i < ordered.length; i++) await session.supabase.from("property_images").update({ sort_order: i }).eq("id", ordered[i]);
  revalidatePath(`/host/properties/${propertyId}`);
}

/* -------------------------------------------------------------------- rooms */
export async function addRoomType(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const values = formValues(formData);
  const parsed = roomTypeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const { error } = await session.supabase.from("room_types").insert({ ...parsed.data, price_inr: parsed.data.price_inr ?? null, description: parsed.data.description || null });
  if (error) return { ok: false, message: friendlyDbError(error), values };
  revalidatePath(`/host/properties/${parsed.data.property_id}`);
  return { ok: true, message: "Room type added." };
}

export async function deleteRoomType(roomId: string, propertyId: string): Promise<void> {
  const session = await hostSession();
  if (!session) return;
  await session.supabase.from("room_types").delete().eq("id", roomId).eq("property_id", propertyId);
  revalidatePath(`/host/properties/${propertyId}`);
}

/* -------------------------------------------------------------------- availability */
export async function blockDates(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const values = formValues(formData);
  const parsed = availabilityBlockSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  const { error } = await session.supabase.from("availability_blocks").insert({ ...parsed.data, reason: parsed.data.reason || null, created_by: session.user.id });
  if (error) return { ok: false, message: friendlyDbError(error), values };
  revalidatePath(`/host/properties/${parsed.data.property_id}/availability`);
  return { ok: true, message: "Dates blocked." };
}

export async function unblockDates(blockId: string, propertyId: string): Promise<void> {
  const session = await hostSession();
  if (!session) return;
  await session.supabase.from("availability_blocks").delete().eq("id", blockId).eq("property_id", propertyId);
  revalidatePath(`/host/properties/${propertyId}/availability`);
}

/* -------------------------------------------------------------------- bookings */
export async function respondToBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const parsed = bookingResponseSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const { booking_id, decision, note } = parsed.data;
  const { data: b } = await session.supabase.from("bookings").select("traveller_id, guest_email, property_name, check_in, check_out").eq("id", booking_id).maybeSingle();
  const { error } = await session.supabase.rpc("respond_to_booking", { p_booking: booking_id, p_accept: decision === "accept", p_note: note ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (b) {
    const mail = bookingEmails.decisionGuest({ property: b.property_name, accepted: decision === "accept", checkIn: formatDate(b.check_in), checkOut: formatDate(b.check_out), note });
    await emailUser(b.traveller_id, mail.subject, mail.body, b.guest_email);
  }
  revalidatePath("/host/bookings");
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: decision === "accept" ? "Booking confirmed. The guest has been notified." : "Request declined. The guest has been notified." };
}

export async function cancelAsHost(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const parsed = cancelSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const { data: b } = await session.supabase.from("bookings").select("traveller_id, guest_email, property_name, check_in, check_out").eq("id", parsed.data.booking_id).maybeSingle();
  const { error } = await session.supabase.rpc("cancel_booking", { p_booking: parsed.data.booking_id, p_note: parsed.data.note ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (b) {
    const mail = bookingEmails.cancelled({ property: b.property_name, checkIn: formatDate(b.check_in), checkOut: formatDate(b.check_out), by: "host" });
    await emailUser(b.traveller_id, mail.subject, mail.body, b.guest_email);
  }
  revalidatePath("/host/bookings");
  revalidatePath("/dashboard/bookings");
  return { ok: true, message: "Booking cancelled and the guest notified." };
}
