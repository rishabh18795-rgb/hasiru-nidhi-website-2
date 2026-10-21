"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { roomTypeSchema, slugify } from "@/lib/validation/property";
import { collectStepValues, crossChecks, parseStep, publicCoordinate } from "@/lib/wizard/schemas";
import { isStepKey, nextStep, wizardPath } from "@/lib/wizard/steps";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/db/types";
import { availabilityBlockSchema, bookingResponseSchema, cancelSchema } from "@/lib/validation/booking";
import { adminNotifyEmail, sendEmail } from "@/lib/email";
import { bookingEmails, emailUser, listingEmails } from "@/lib/notifications";
import { formatDate } from "@/lib/format";

const DENIED: FormState = { ok: false, message: "You don't have permission to do that." };
const MAX_IMAGES = 20;

async function hostSession() {
  try {
    return await assertRole(["host"]);
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

/* -------------------------------------------------------------------- listing wizard */
const EDITABLE_STATUSES = ["draft", "rejected", "approved"];
const NOT_EDITABLE: Record<string, string> = {
  pending_review: "This listing is awaiting review, so it can't be edited until the review is finished.",
  suspended: "This listing has been suspended by an administrator and can't be edited. Please contact support.",
};

/**
 * Saves ONE step of the listing wizard and moves on.
 *  intent=continue → strict validation, then redirect to the next step.
 *  intent=save     → lenient validation (blank = not filled in yet), stays on the step.
 * Ownership, status rules and what a host may change are enforced by Row Level Security and the guard triggers;
 * the checks here only give friendly messages.
 */
export async function saveWizardStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const raw = collectStepValues(formData);
  if (!isStepKey(raw.step)) return { ok: false, message: "Unknown step." };
  const step = raw.step;
  const strict = raw.intent !== "save";
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const { supabase, user } = session;
  const propertyId = typeof raw.property_id === "string" ? raw.property_id : "";

  let existing: Property | null = null;
  if (propertyId) {
    if (!/^[0-9a-f-]{36}$/.test(propertyId)) return DENIED;
    const { data } = await supabase.from("properties").select("*").eq("id", propertyId).eq("host_id", user.id).maybeSingle();
    if (!data) return DENIED;
    existing = data as Property;
    if (!EDITABLE_STATUSES.includes(existing.status)) return { ok: false, message: NOT_EDITABLE[existing.status] ?? DENIED.message, values };
  } else if (step !== "type") {
    return DENIED;
  }

  const parsed = parseStep(step, raw, strict);
  if (!parsed.ok) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: parsed.errors, values };
  const d = parsed.data as Record<string, unknown>;

  const cross = crossChecks(step, { country: existing?.country, price_unit: existing?.price_unit, ...d }, strict, { max_guests: existing?.max_guests });
  if (!existing && step === "type") {
    if (!d.name) cross.name = ["Property name is required"];
    if (!d.category_id) cross.category_id = ["Choose a property type"];
  }
  if (Object.keys(cross).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: cross, values };

  const now = new Date().toISOString();
  let id = existing?.id ?? "";
  let dbError: { message?: string; code?: string } | null = null;

  switch (step) {
    case "type": {
      if (!existing) {
        const slug = `${slugify(String(d.name))}-${randomUUID().slice(0, 6)}`;
        const { data, error } = await supabase
          .from("properties")
          .insert({ host_id: user.id, slug, status: "draft", name: d.name, category_id: d.category_id, wizard_step: "type" })
          .select("id")
          .single();
        dbError = error;
        id = (data?.id as string | undefined) ?? "";
      } else {
        ({ error: dbError } = await supabase.from("properties").update({ name: d.name, category_id: d.category_id, wizard_step: "type" }).eq("id", id));
      }
      break;
    }
    case "location": {
      const precision = d.location_precision as "approximate" | "exact" | undefined;
      ({ error: dbError } = await supabase.from("properties").update({
        ...(d.country ? { country: d.country } : {}),
        ...(precision ? { location_precision: precision } : {}),
        state: d.state ?? null,
        city: d.city ?? null,
        region: d.region ?? null,
        postal_code: d.postal_code ?? null,
        latitude: publicCoordinate(d.latitude as number | undefined, precision ?? existing?.location_precision),
        longitude: publicCoordinate(d.longitude as number | undefined, precision ?? existing?.location_precision),
        wizard_step: "location",
      }).eq("id", id));
      if (!dbError) {
        ({ error: dbError } = await supabase.from("property_private").upsert({
          property_id: id,
          address_line: d.address_line ?? null,
          exact_latitude: d.latitude ?? null,
          exact_longitude: d.longitude ?? null,
        }));
      }
      break;
    }
    case "details": {
      ({ error: dbError } = await supabase.from("properties").update({
        summary: d.summary ?? null,
        description: d.description ?? "",
        ...(d.rooms_count !== undefined ? { rooms_count: d.rooms_count } : {}),
        ...(d.max_guests !== undefined ? { max_guests: d.max_guests } : {}),
        bedrooms: d.bedrooms ?? null,
        beds: d.beds ?? null,
        bathrooms: d.bathrooms ?? null,
        accommodation_arrangement: d.accommodation_arrangement ?? null,
        ...(d.check_in_time ? { check_in_time: d.check_in_time } : {}),
        ...(d.check_out_time ? { check_out_time: d.check_out_time } : {}),
        house_rules: d.house_rules ?? null,
        wizard_step: "details",
      }).eq("id", id));
      break;
    }
    case "amenities": {
      dbError = await syncLinks(supabase, "property_amenities", "amenity_id", id, (d.amenity_ids as number[]) ?? []);
      if (!dbError) dbError = await syncLinks(supabase, "property_experiences", "experience_id", id, (d.experience_ids as number[]) ?? []);
      if (!dbError) ({ error: dbError } = await supabase.from("properties").update({ wizard_step: "amenities" }).eq("id", id));
      break;
    }
    case "pricing": {
      const perGuest = d.price_unit === "per_person_night";
      ({ error: dbError } = await supabase.from("properties").update({
        ...(d.price_unit ? { price_unit: d.price_unit } : {}),
        price_inr: d.price_inr ?? null,
        weekend_price_inr: d.weekend_price_inr ?? null,
        included_guests: perGuest ? null : (d.included_guests ?? null),
        extra_guest_fee_inr: perGuest ? null : (d.extra_guest_fee_inr ?? null),
        cleaning_fee_inr: d.cleaning_fee_inr ?? null,
        tax_percent: d.tax_percent ?? existing?.tax_percent ?? 0,
        min_nights: d.min_nights ?? existing?.min_nights ?? 1,
        max_nights: d.max_nights ?? existing?.max_nights ?? 30,
        wizard_step: "pricing",
      }).eq("id", id));
      break;
    }
    case "review": {
      ({ error: dbError } = await supabase.from("properties").update({
        ...(d.cancellation_policy ? { cancellation_policy: d.cancellation_policy } : {}),
        terms_accepted_at: d.accept_terms ? (existing?.terms_accepted_at ?? now) : null,
        photo_rights_confirmed_at: d.accept_photo_rights ? (existing?.photo_rights_confirmed_at ?? now) : null,
        wizard_step: "review",
      }).eq("id", id));
      if (!dbError) {
        ({ error: dbError } = await supabase.from("property_private").upsert({
          property_id: id,
          contact_name: d.contact_name ?? null,
          contact_phone: d.contact_phone ?? null,
          contact_email: d.contact_email ?? null,
          current_platforms: d.current_platforms ?? null,
          partnership_model: d.partnership_model ?? null,
        }));
      }
      break;
    }
    default: {
      ({ error: dbError } = await supabase.from("properties").update({ wizard_step: step }).eq("id", id));
    }
  }

  if (dbError || !id) return { ok: false, message: friendlyDbError(dbError), values };

  revalidatePath("/host/properties");
  revalidatePath(`/host/properties/${id}`);
  if (strict) {
    const next = nextStep(step);
    redirect(next ? wizardPath(id, next) : `/host/properties/${id}`);
  }
  if (!existing) redirect(`${wizardPath(id, step)}?saved=1`);
  return { ok: true, message: "Draft saved.", values };
}

/** Makes the stored link rows equal `wanted` without ever deleting everything first. */
async function syncLinks(
  supabase: SupabaseClient,
  table: "property_amenities" | "property_experiences",
  column: "amenity_id" | "experience_id",
  propertyId: string,
  wanted: number[],
): Promise<{ message?: string; code?: string } | null> {
  const { data, error } = await supabase.from(table).select(column).eq("property_id", propertyId);
  if (error) return error;
  const have = new Set((data ?? []).map((r) => (r as unknown as Record<string, number>)[column]));
  const want = new Set(wanted);
  const toAdd = [...want].filter((x) => !have.has(x));
  const toRemove = [...have].filter((x) => !want.has(x));
  if (toAdd.length) {
    const { error: e } = await supabase.from(table).insert(toAdd.map((x) => ({ property_id: propertyId, [column]: x })));
    if (e) return e;
  }
  if (toRemove.length) {
    const { error: e } = await supabase.from(table).delete().eq("property_id", propertyId).in(column, toRemove);
    if (e) return e;
  }
  return null;
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
  // Only reached when the database accepted the submission (submit_property raised nothing).
  redirect(`/host/properties/${id}/submitted`);
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

export async function reorderPropertyImages(propertyId: string, orderedIds: string[]): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(propertyId) || orderedIds.length > MAX_IMAGES || !orderedIds.every((i) => uuid.test(i))) return { ok: false, message: "Invalid request." };
  const { error } = await session.supabase.rpc("reorder_property_images", { p_property: propertyId, p_order: orderedIds });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/host/properties/${propertyId}`);
  return { ok: true };
}

export async function makeCoverImage(imageId: string, propertyId: string): Promise<FormState> {
  const session = await hostSession();
  if (!session) return DENIED;
  const { data: imgs } = await session.supabase.from("property_images").select("id").eq("property_id", propertyId).order("sort_order").order("created_at");
  const ids = (imgs ?? []).map((i) => i.id as string);
  if (!ids.includes(imageId)) return { ok: false, message: "Photo not found." };
  return reorderPropertyImages(propertyId, [imageId, ...ids.filter((i) => i !== imageId)]);
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
