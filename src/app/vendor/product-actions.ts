"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { adjustSchema, parseLabelLines, productSchema, variantSchema } from "@/lib/validation/product";

const DENIED: FormState = { ok: false, message: "Please sign in to continue." };

/** The database decides whether this account may sell (capability, ownership, state); this only needs a signed-in account. */
async function seller() {
  const session = await getSession();
  if (!session || session.profile.is_suspended || session.profile.role === "admin") return null;
  return session;
}

function revalidateProduct(id?: string) {
  revalidatePath("/vendor/products");
  revalidatePath("/vendor/inventory");
  if (id) revalidatePath(`/vendor/products/${id}`);
}

/** Creates a draft (then opens its editor) or saves changes to an existing product. Name, category, description and specifications. */
export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = productSchema.safeParse(raw);
  const spec = parseLabelLines(raw.specifications ?? "", 20);
  if (!parsed.success || spec.errors.length) {
    const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { ...fieldErrors, ...(spec.errors.length ? { specifications: spec.errors } : {}) }, values: raw };
  }
  if (!(await withinRateLimit("catalogueWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const d = parsed.data;
  const { data, error } = await session.supabase.rpc("save_product", {
    p: { id: d.id ?? null, category_id: d.category_id, name: d.name, summary: d.summary, description: d.description, brand: d.brand, attributes: spec.items },
  });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidateProduct(String(data));
  if (!d.id) redirect(`/vendor/products/${data}`);
  return { ok: true, message: "Saved.", values: raw };
}

export async function saveVariant(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = variantSchema.safeParse(raw);
  const opts = parseLabelLines(raw.options ?? "", 5);
  if (!parsed.success || opts.errors.length) {
    const fieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: { ...fieldErrors, ...(opts.errors.length ? { options: opts.errors } : {}) }, values: raw };
  }
  if (!(await withinRateLimit("catalogueWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const d = parsed.data;
  const { error } = await session.supabase.rpc("save_product_variant", {
    p: { id: d.id ?? null, product_id: d.product_id, sku: d.sku, name: d.name, options: Object.fromEntries(opts.items.map((o) => [o.label, o.value])), price_inr: d.price_inr,
         weight_grams: d.weight_grams ?? null, track_inventory: d.track_inventory, is_active: d.is_active, initial_stock: d.initial_stock },
  });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidateProduct(d.product_id);
  return { ok: true, message: d.id ? "Variant saved." : "Variant added.", values: {} };
}

export async function adjustInventory(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const raw = formValues(formData);
  const parsed = adjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: Object.values(zodFieldErrors(parsed.error)).flat()[0] ?? "Check the quantity.", values: raw };
  if (!(await withinRateLimit("catalogueWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const d = parsed.data;
  const { data, error } = await session.supabase.rpc("adjust_inventory", { p_variant: d.variant_id, p_mode: d.mode, p_quantity: d.quantity, p_reason: d.reason, p_note: d.note || null });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidateProduct(raw.product_id);
  return { ok: true, message: `Stock is now ${data}.`, values: {} };
}

/** Called after the browser has uploaded the photo to the public bucket with the seller's own session. */
export async function registerProductImage(productId: string, path: string, alt: string): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  if (!(await withinRateLimit("upload", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { error } = await session.supabase.rpc("register_product_image", { p_product: productId, p_path: path, p_alt: alt || null });
  if (error) {
    await session.supabase.storage.from("product-images").remove([path]);
    return { ok: false, message: friendlyDbError(error) };
  }
  revalidateProduct(productId);
  return { ok: true, message: "Photo added." };
}

export async function deleteProductImage(productId: string, imageId: string): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const { data, error } = await session.supabase.rpc("delete_product_image", { p_image: imageId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (typeof data === "string") await session.supabase.storage.from("product-images").remove([data]);
  revalidateProduct(productId);
  return { ok: true, message: "Photo removed." };
}

export async function reorderProductImages(productId: string, ids: string[]): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const { error } = await session.supabase.rpc("reorder_product_images", { p_product: productId, p_ids: ids });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateProduct(productId);
  return { ok: true };
}

type Simple = "submit_product" | "archive_product" | "restore_product";
export async function productLifecycle(productId: string, action: Simple): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  if (!["submit_product", "archive_product", "restore_product"].includes(action)) return { ok: false, message: "Unknown action." };
  const { error } = await session.supabase.rpc(action, { p_product: productId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateProduct(productId);
  return { ok: true, message: action === "submit_product" ? "Submitted for review. Our team will look at it soon." : action === "archive_product" ? "Archived." : "Restored as a draft." };
}

export async function setProductAvailability(productId: string, available: boolean): Promise<FormState> {
  const session = await seller();
  if (!session) return DENIED;
  const { error } = await session.supabase.rpc("set_product_availability", { p_product: productId, p_available: available });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidateProduct(productId);
  return { ok: true, message: available ? "Marked available." : "Paused: shoppers will see it as currently unavailable." };
}
