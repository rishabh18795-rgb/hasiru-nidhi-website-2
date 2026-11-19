"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { parsePinList, submitSchema, vendorDraftSchema, vendorProfileSchema } from "@/lib/validation/vendor";

const DENIED: FormState = { ok: false, message: "Please sign in to continue." };

/** Any signed-in, active, non-admin account may use the vendor area; what they can do there is decided by the database. */
async function accountSession() {
  const session = await getSession();
  if (!session || session.profile.is_suspended || session.profile.role === "admin") return null;
  return session;
}

/**
 * Saves the business profile. intent=save keeps a draft (blanks allowed); intent=submit validates everything, saves, then
 * submits the application for the chosen capabilities. Status rules and who may edit what are enforced in the database.
 */
export async function saveVendorProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await accountSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const values = { ...raw };
  const submitting = raw.intent === "submit";
  const capabilities = formData.getAll("capabilities").map(String);

  const parsed = (submitting ? vendorProfileSchema : vendorDraftSchema).safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values };
  let caps: ("products" | "services" | "stays")[] = [];
  if (submitting) {
    const c = submitSchema.safeParse({ capabilities });
    if (!c.success) return { ok: false, message: "Choose at least one thing you want to do on Hasiru Nidhi.", values };
    caps = c.data.capabilities;
  }
  if (!(await withinRateLimit("vendorWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values };

  const { error } = await session.supabase.rpc("save_vendor_profile", { p: parsed.data });
  if (error) return { ok: false, message: friendlyDbError(error), values };
  if (submitting) {
    const { error: submitError } = await session.supabase.rpc("submit_vendor_application", { p_capabilities: caps });
    if (submitError) return { ok: false, message: friendlyDbError(submitError), values };
  }
  revalidatePath("/vendor", "layout");
  return { ok: true, message: submitting ? "Application submitted. Our team will review it and you will be notified." : "Draft saved.", values };
}

/** Called after the browser has uploaded the file to the private bucket with the vendor's own session. */
export async function registerVendorDocument(requirementId: number | null, label: string, path: string, originalName: string): Promise<FormState> {
  const session = await accountSession();
  if (!session) return DENIED;
  if (!(await withinRateLimit("upload", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { error } = await session.supabase.rpc("register_vendor_document", { p_requirement: requirementId, p_label: label.slice(0, 120), p_path: path, p_name: originalName.slice(0, 200) });
  if (error) {
    // The row was refused, so do not leave an orphan file behind.
    await session.supabase.storage.from("vendor-documents").remove([path]);
    return { ok: false, message: friendlyDbError(error) };
  }
  revalidatePath("/vendor/verification");
  return { ok: true, message: "Document uploaded." };
}

export async function deleteVendorDocument(documentId: string): Promise<FormState> {
  const session = await accountSession();
  if (!session) return DENIED;
  const { data, error } = await session.supabase.rpc("delete_vendor_document", { p_document: documentId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (typeof data === "string") await session.supabase.storage.from("vendor-documents").remove([data]);
  revalidatePath("/vendor/verification");
  return { ok: true, message: "Document removed." };
}

export async function saveCoverage(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await accountSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const scope = raw.scope === "service" ? "service" : "delivery";
  const { codes, invalid } = parsePinList(raw.pins ?? "");
  if (invalid.length) return { ok: false, message: `These are not valid: ${invalid.slice(0, 5).join(", ")}. Use 6-digit PIN codes, or a 3-digit prefix to cover a whole area.`, values: raw };
  if (!(await withinRateLimit("vendorWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { data, error } = await session.supabase.rpc("set_vendor_service_areas", { p_scope: scope, p_codes: codes });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/vendor/coverage");
  return { ok: true, message: Number(data) === 0 ? "Coverage cleared." : `Saved ${data} PIN code${Number(data) === 1 ? "" : "s"} or area${Number(data) === 1 ? "" : "s"}.`, values: raw };
}

export async function requestCapability(capability: string): Promise<FormState> {
  const session = await accountSession();
  if (!session) return DENIED;
  if (!["products", "services", "stays"].includes(capability)) return { ok: false, message: "Unknown option." };
  if (!(await withinRateLimit("vendorWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { error } = await session.supabase.rpc("request_vendor_capability", { p_capability: capability });
  if (error) return { ok: false, message: error.message.includes("invalid_status") ? "That is already requested or approved." : friendlyDbError(error) };
  revalidatePath("/vendor", "layout");
  return { ok: true, message: "Requested. Our team will review it." };
}
