"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthorizationError, assertRole } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
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

const reviewSchema = z.object({
  product_id: z.uuid(),
  decision: z.enum(["approve", "reject", "request_changes", "suspend", "reinstate"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function reviewProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error), message: "Choose a decision.", values: raw };
  const { product_id, decision, reason } = parsed.data;
  const { error } = await session.supabase.rpc("admin_review_product", { p_product: product_id, p_decision: decision, p_reason: reason ?? null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${product_id}`);
  revalidatePath("/shop", "layout");
  return { ok: true, message: "Decision recorded." };
}

export async function setProductFeatured(productId: string, featured: boolean): Promise<void> {
  const session = await adminSession();
  if (!session) return;
  await session.supabase.rpc("admin_set_product_featured", { p_product: productId, p_featured: featured });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop", "layout");
}

const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: z.string().trim().max(400).optional(),
});

export async function addProductCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  const { data: last } = await session.supabase.from("product_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const slug = slugify(parsed.data.name).slice(0, 60);
  if (slug.length < 2 || slug === "all") return { ok: false, message: "Choose a more descriptive name.", values: raw };
  const { error } = await session.supabase.from("product_categories").insert({ slug, name: parsed.data.name, description: parsed.data.description || null, sort_order: ((last?.sort_order as number | undefined) ?? 0) + 10 });
  if (error) return { ok: false, message: error.code === "23505" ? "A category with that name already exists." : friendlyDbError(error), values: raw };
  revalidatePath("/admin/product-categories");
  revalidatePath("/shop", "layout");
  return { ok: true, message: "Category added." };
}

export async function updateProductCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await adminSession();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const id = Number(raw.id);
  const parsed = categorySchema.safeParse(raw);
  if (!Number.isInteger(id) || !parsed.success) return { ok: false, message: "Enter a name of at least 2 characters." };
  const { error } = await session.supabase.from("product_categories").update({ name: parsed.data.name, description: parsed.data.description || null, is_active: raw.is_active === "true" }).eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/admin/product-categories");
  revalidatePath("/shop", "layout");
  return { ok: true, message: "Saved." };
}

/** Moves a category one place up or down by re-sending the whole order (the database validates it). */
export async function moveProductCategory(id: number, direction: "up" | "down"): Promise<void> {
  const session = await adminSession();
  if (!session) return;
  const { data } = await session.supabase.from("product_categories").select("id").order("sort_order").order("id");
  const ids = (data ?? []).map((r) => r.id as number);
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await session.supabase.rpc("admin_reorder_product_categories", { p_ids: ids });
  revalidatePath("/admin/product-categories");
  revalidatePath("/shop", "layout");
}
