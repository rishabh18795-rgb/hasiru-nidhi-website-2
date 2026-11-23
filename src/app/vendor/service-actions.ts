"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { parseLabelLines } from "@/lib/validation/product";
import { parseAvailability, serviceSchema, timeOffSchema } from "@/lib/validation/service";

const DENIED: FormState = { ok: false, message: "Please sign in to continue." };

/** The database decides whether this account may provide services (capability, ownership, state); this only needs a signed-in account. */
async function provider() {
  const session = await getSession();
  if (!session || session.profile.is_suspended || session.profile.role === "admin") return null;
  return session;
}

function revalidateService(id?: string) {
  revalidatePath("/vendor/services");
  if (id) revalidatePath(`/vendor/services/${id}`);
  revalidatePath("/services", "layout");
}

/** Creates a draft (then opens its editor) or saves changes to an existing listing. */
export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = serviceSchema.safeParse(raw);
  const spec = parseLabelLines(raw.specifications ?? "", 20);
  if (!parsed.success || spec.errors.length) {
    const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { ...fieldErrors, ...(spec.errors.length ? { specifications: spec.errors } : {}) }, values: raw };
  }
  if (!(await withinRateLimit("catalogueWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const d = parsed.data;
  const fixed = d.pricing_model === "fixed";
  const { data, error } = await session.supabase.rpc("save_service", {
    p: { id: d.id ?? null, category_id: d.category_id, name: d.name, summary: d.summary, description: d.description, pricing_model: d.pricing_model,
         price_inr: fixed ? d.price_inr : null, price_unit: fixed ? d.price_unit : null, duration_minutes: d.duration_minutes, attributes: spec.items },
  });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidateService(String(data));
  if (!d.id) redirect(`/vendor/services/${data}`);
  return { ok: true, message: "Saved.", values: raw };
}

export async function registerServiceImage(serviceId: string, path: string, alt: string): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  if (!(await withinRateLimit("upload", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { error } = await session.supabase.rpc("register_service_image", { p_service: serviceId, p_path: path, p_alt: alt || null });
  if (error) {
    await session.supabase.storage.from("service-images").remove([path]);
    return { ok: false, message: friendlyDbError(error) };
  }
  revalidateService(serviceId);
  return { ok: true, message: "Photo added." };
}

export async function deleteServiceImage(serviceId: string, imageId: string): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const { data, error } = await session.supabase.rpc("delete_service_image", { p_image: imageId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (typeof data === "string") await session.supabase.storage.from("service-images").remove([data]);
  revalidateService(serviceId);
  return { ok: true, message: "Photo removed." };
}

export async function reorderServiceImages(serviceId: string, ids: string[]): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const { error } = await session.supabase.rpc("reorder_service_images", { p_service: serviceId, p_ids: ids });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateService(serviceId);
  return { ok: true };
}

type Simple = "submit_service" | "archive_service" | "restore_service";
export async function serviceLifecycle(serviceId: string, action: Simple): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  if (!["submit_service", "archive_service", "restore_service"].includes(action)) return { ok: false, message: "Unknown action." };
  const { error } = await session.supabase.rpc(action, { p_service: serviceId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateService(serviceId);
  return { ok: true, message: action === "submit_service" ? "Submitted for review. Our team will look at it soon." : action === "archive_service" ? "Archived." : "Restored as a draft." };
}

export async function setServiceAvailable(serviceId: string, available: boolean): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const { error } = await session.supabase.rpc("set_service_availability_flag", { p_service: serviceId, p_available: available });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateService(serviceId);
  return { ok: true, message: available ? "Accepting requests again." : "Paused: customers will see it as currently unavailable." };
}

/** Replaces the weekly hours. A day left blank means not available that day. */
export async function saveAvailability(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const { rules, errors } = parseAvailability(raw);
  if (errors.length) return { ok: false, message: errors[0], values: raw };
  if (!(await withinRateLimit("vendorWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("set_service_availability", { p_rules: rules });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/vendor/availability");
  revalidatePath("/services", "layout");
  return { ok: true, message: rules.length ? "Weekly hours saved. Customers can only pick times inside them." : "Weekly hours cleared. You will confirm times with each customer yourself.", values: raw };
}

export async function addTimeOff(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = timeOffSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  if (!(await withinRateLimit("vendorWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("add_service_time_off", { p_start: parsed.data.starts_on, p_end: parsed.data.ends_on, p_note: parsed.data.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/vendor/availability");
  return { ok: true, message: "Days off added. Those days will not be offered.", values: {} };
}

export async function deleteTimeOff(id: string): Promise<FormState> {
  const session = await provider();
  if (!session) return DENIED;
  const { error } = await session.supabase.rpc("delete_service_time_off", { p_id: id });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/vendor/availability");
  return { ok: true };
}
