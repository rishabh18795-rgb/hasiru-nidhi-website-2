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
  decision: z.enum(["approve", "reject", "request_changes", "suspend", "reinstate"]),
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

  const label = { approve: "approved", reject: "rejected", request_changes: "returned to you for changes", suspend: "suspended", reinstate: "reinstated" }[decision];
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

/* ---------------------------------------------------------------- reviews */
/** Hide or restore a review. Goes through moderate_review(), which re-checks the admin role and writes the audit entry. */
export async function moderateReview(reviewId: string, hidden: boolean): Promise<void> {
  const session = await adminSession();
  if (!session || !z.uuid().safeParse(reviewId).success) return;
  await session.supabase.rpc("moderate_review", { p_review: reviewId, p_hidden: hidden, p_reason: null });
  revalidatePath("/admin/reviews");
  revalidatePath("/stays", "layout");
}

/* ---------------------------------------------------------------- finance: payments, commission, settlements */
// Every function below goes through a SECURITY DEFINER database function that re-checks the admin role, validates the
// amounts and writes the audit entry. Nothing here marks a payment as received unless an administrator states that it was.
const FINANCE_PATHS = ["/admin/payments", "/admin/commission", "/admin/settlements", "/admin/bookings"];
const revalidateFinance = () => FINANCE_PATHS.forEach((p) => revalidatePath(p));
const money = z.coerce.number("Enter an amount").positive("Enter an amount above zero").max(10_000_000, "That amount is too large");

const paymentSchema = z.object({
  booking_id: z.uuid(),
  amount: money,
  reference: z.string().trim().min(2, "Enter the bank / UPI reference").max(120),
  note: z.string().trim().max(500).optional(),
});

export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const values = formValues(formData);
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Please fix the highlighted fields.", values };
  const { error } = await session.supabase.rpc("admin_record_payment", {
    p_booking: parsed.data.booking_id, p_amount: parsed.data.amount, p_reference: parsed.data.reference, p_note: parsed.data.note || null, p_provider: "manual",
  });
  if (error) return { ok: false, message: friendlyDbError(error), values };
  revalidateFinance();
  return { ok: true, message: "Payment recorded." };
}

const refundSchema = z.object({
  payment_id: z.uuid(),
  amount: money,
  reason: z.string().trim().min(3, "Enter a reason").max(300),
});

export async function recordRefund(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const values = formValues(formData);
  const parsed = refundSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Please fix the highlighted fields.", values };
  const { error } = await session.supabase.rpc("admin_record_refund", { p_payment: parsed.data.payment_id, p_amount: parsed.data.amount, p_reason: parsed.data.reason });
  if (error) return { ok: false, message: friendlyDbError(error), values };
  revalidateFinance();
  return { ok: true, message: "Refund recorded." };
}

const commissionSchema = z.object({
  rate: z.coerce.number("Enter a percentage").min(0, "Minimum 0").max(50, "Maximum 50"),
  basis: z.enum(["accommodation", "accommodation_and_cleaning"]),
});

export async function setCommission(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const values = formValues(formData);
  const parsed = commissionSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Please fix the highlighted fields.", values };
  const { error } = await session.supabase.rpc("admin_set_commission", {
    p_rate: parsed.data.rate, p_basis: parsed.data.basis,
    p_reverse_on_cancellation: values.reverse_on_cancellation === "on", p_refund_reverses: values.refund_reverses === "on", p_settlement_requires_payment: values.settlement_requires_payment === "on",
  });
  if (error) return { ok: false, message: friendlyDbError(error), values };
  revalidateFinance();
  return { ok: true, message: "Commission settings saved. They apply to new bookings only." };
}

export async function createSettlement(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const host = z.uuid().safeParse(formData.get("host_id"));
  if (!host.success) return { ok: false, message: "Invalid request." };
  const note = String(formData.get("note") ?? "").slice(0, 500);
  const { error } = await session.supabase.rpc("admin_create_settlement", { p_host: host.data, p_note: note || null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateFinance();
  return { ok: true, message: "Settlement created." };
}

const settlementSchema = z.object({
  settlement_id: z.uuid(),
  status: z.enum(["pending", "processing", "paid", "on_hold", "failed"]),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function updateSettlement(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const parsed = settlementSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { error } = await session.supabase.rpc("admin_update_settlement", {
    p_settlement: parsed.data.settlement_id, p_status: parsed.data.status, p_reference: parsed.data.reference || null, p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateFinance();
  return { ok: true, message: "Settlement updated." };
}

export async function adminCompleteBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const id = z.uuid().safeParse(formData.get("booking_id"));
  if (!id.success) return { ok: false, message: "Invalid request." };
  const { error } = await session.supabase.rpc("complete_booking", { p_booking: id.data });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateFinance();
  return { ok: true, message: "Stay marked completed." };
}
