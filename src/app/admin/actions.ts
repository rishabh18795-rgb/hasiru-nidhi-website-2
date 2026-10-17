"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { emailUser, listingEmails } from "@/lib/notifications";
import { z } from "zod";
import { slugify } from "@/lib/validation/property";

const DENIED: FormState = { ok: false, message: "Administrator access is required." };

async function adminSession() {
  try {
    return await assertRole(["admin"]);
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

/* ---------------------------------------------------------------- listing review */
const reviewSchema = z.object({
  property_id: z.uuid(),
  decision: z.enum(["approve", "reject", "suspend", "reinstate"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function reviewListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = reviewSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Choose a decision." };
  const { property_id, decision, reason } = parsed.data;

  const { data: p } = await session.supabase.from("properties").select("name, host_id").eq("id", property_id).maybeSingle();
  const { error } = await session.supabase.rpc("review_property", { p_property: property_id, p_decision: decision, p_reason: reason ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };

  const label = { approve: "approved", reject: "rejected", suspend: "suspended", reinstate: "reinstated" }[decision];
  if (p?.host_id) {
    const mail = listingEmails.decisionHost({ name: p.name, decision: label, reason });
    await emailUser(p.host_id, mail.subject, mail.body);
  }
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${property_id}`);
  revalidatePath("/stays");
  return { ok: true, message: `Listing ${label}.` };
}

export async function toggleFeatured(propertyId: string, featured: boolean): Promise<void> {
  const session = await adminSession();
  if (!session) return;
  await session.supabase.from("properties").update({ is_featured: featured }).eq("id", propertyId);
  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/stays");
  revalidatePath("/");
}

/* ---------------------------------------------------------------- users */
const userSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(["traveller", "host", ""]).optional(),
  suspended: z.enum(["true", "false", ""]).optional(),
  verified: z.enum(["true", "false", ""]).optional(),
});

export async function updateUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = userSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { user_id, role, suspended, verified } = parsed.data;
  if (user_id === session.user.id) return { ok: false, message: "You can't change your own account here." };
  const { error } = await session.supabase.rpc("admin_update_user", {
    p_user: user_id,
    p_role: role || null,
    p_suspended: suspended ? suspended === "true" : null,
    p_verified: verified ? verified === "true" : null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/admin/users");
  return { ok: true, message: "User updated." };
}

/* ---------------------------------------------------------------- enquiries */
const triageSchema = z.object({
  table: z.enum(["contact_enquiries", "gardening_enquiries", "partner_applications", "reports"]),
  id: z.uuid(),
  status: z.string().max(30),
  admin_notes: z.string().trim().max(3000).optional(),
});
const ALLOWED_STATUS: Record<string, string[]> = {
  contact_enquiries: ["new", "in_progress", "resolved", "spam"],
  gardening_enquiries: ["new", "in_progress", "resolved", "spam"],
  partner_applications: ["new", "contacted", "invited", "closed"],
  reports: ["open", "reviewing", "closed"],
};

export async function triageItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = triageSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { table, id, status, admin_notes } = parsed.data;
  if (!ALLOWED_STATUS[table].includes(status)) return { ok: false, message: "Invalid status." };
  const patch: Record<string, unknown> = { status };
  if (table !== "reports") patch.admin_notes = admin_notes || null;
  const { error } = await session.supabase.from(table).update(patch).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/reports");
  return { ok: true, message: "Saved." };
}

/* ---------------------------------------------------------------- catalogue */
const catalogSchema = z.object({
  kind: z.enum(["property_categories", "amenities", "experiences"]),
  name: z.string().trim().min(2, "Enter a name").max(80),
  group_name: z.string().trim().max(40).optional(),
});

export async function addCatalogItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = catalogSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const { kind, name, group_name } = parsed.data;
  const row: Record<string, unknown> = { slug: slugify(name), name };
  if (kind === "amenities") row.group_name = group_name || "general";
  const { error } = await session.supabase.from(kind).insert(row);
  if (error) return { ok: false, message: /duplicate|unique/i.test(error.message) ? "That item already exists." : friendlyDbError(error) };
  revalidatePath("/admin/catalog");
  return { ok: true, message: "Added." };
}

export async function setCatalogActive(kind: string, id: number, active: boolean): Promise<void> {
  const session = await adminSession();
  if (!session || !["property_categories", "amenities", "experiences"].includes(kind)) return;
  await session.supabase.from(kind).update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/catalog");
}

/* ---------------------------------------------------------------- settings */
const SETTING_KEYS = ["whatsapp_number", "support_email", "support_phone", "announcement"] as const;

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const values = formValues(formData);
  const out: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    let v = (values[key] ?? "").trim();
    if (key === "whatsapp_number") {
      v = v.replace(/\D/g, "");
      if (v && (v.length < 10 || v.length > 15)) return { ok: false, message: "WhatsApp number must be 10–15 digits including the country code (e.g. 9198XXXXXXXX).", values };
    }
    if (key === "support_email" && v && !z.email().safeParse(v).success) return { ok: false, message: "Enter a valid support email.", values };
    if (key === "announcement" && v.length > 200) return { ok: false, message: "Keep the announcement under 200 characters.", values };
    out[key] = v;
  }
  for (const [key, value] of Object.entries(out)) {
    const { error } = await session.supabase.from("platform_settings").update({ value, updated_by: session.user.id, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) return { ok: false, message: friendlyDbError(error), values };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/* ---------------------------------------------------------------- bookings */
export async function adminCancelBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const id = String(formData.get("booking_id") ?? "");
  const { error } = await session.supabase.rpc("cancel_booking", { p_booking: id, p_note: "Cancelled by an administrator" });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/admin/bookings");
  return { ok: true, message: "Booking cancelled." };
}
