"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { cancelRequestSchema, reviewServiceSchema } from "@/lib/validation/service";
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

export async function reviewService(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = reviewServiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Choose a decision.", values: raw };
  const { service_id, decision, reason } = parsed.data;
  const { error } = await session.supabase.rpc("admin_review_service", { p_service: service_id, p_decision: decision, p_reason: reason || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${service_id}`);
  revalidatePath("/services", "layout");
  return { ok: true, message: "Decision recorded." };
}

export async function setServiceFeatured(serviceId: string, featured: boolean): Promise<void> {
  const session = await adminSession();
  if (!session) return;
  await session.supabase.rpc("admin_set_service_featured", { p_service: serviceId, p_featured: featured });
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/services", "layout");
}

export async function adminCancelServiceRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = cancelRequestSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.reason) return { ok: false, message: "A reason is required.", values: raw };
  const { error } = await session.supabase.rpc("admin_cancel_service_request", { p_request: parsed.data.request_id, p_reason: parsed.data.reason });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/admin/service-requests");
  revalidatePath(`/admin/service-requests/${parsed.data.request_id}`);
  return { ok: true, message: "Request cancelled. Both parties have been told." };
}

const categorySchema = z.object({ name: z.string().trim().min(2, "Enter a name").max(80), description: z.string().trim().max(400).optional() });

export async function addServiceCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const { data: last } = await session.supabase.from("service_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const slug = slugify(parsed.data.name).slice(0, 60);
  if (slug.length < 2 || slug === "all") return { ok: false, message: "Choose a more descriptive name.", values: raw };
  const { error } = await session.supabase.from("service_categories").insert({ slug, name: parsed.data.name, description: parsed.data.description || null, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10 });
  if (error) return { ok: false, message: error.code === "23505" ? "A category with that name already exists." : friendlyDbError(error), values: raw };
  revalidatePath("/admin/service-categories");
  revalidatePath("/services", "layout");
  return { ok: true, message: "Category added." };
}

export async function updateServiceCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const id = Number(raw.id);
  const parsed = categorySchema.safeParse(raw);
  if (!Number.isInteger(id) || !parsed.success) return { ok: false, message: "Enter a name of at least 2 characters." };
  const { error } = await session.supabase.from("service_categories").update({ name: parsed.data.name, description: parsed.data.description || null, is_active: raw.is_active === "true" }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/admin/service-categories");
  revalidatePath("/services", "layout");
  return { ok: true, message: "Saved." };
}

export async function moveServiceCategory(id: number, direction: "up" | "down"): Promise<void> {
  const session = await adminSession();
  if (!session) return;
  const { data } = await session.supabase.from("service_categories").select("id").order("sort_order").order("id");
  const ids = (data ?? []).map((r) => r.id as number);
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await session.supabase.rpc("admin_reorder_service_categories", { p_ids: ids });
  revalidatePath("/admin/service-categories");
  revalidatePath("/services", "layout");
}
