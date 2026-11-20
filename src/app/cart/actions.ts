"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { formValues, friendlyDbError, zodFieldErrors, type FormState } from "@/lib/action";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { addressSchema } from "@/lib/validation/order";

export interface CartResult { ok: boolean; message: string; needsSignIn?: boolean; quantity?: number }

async function shopper() {
  const s = await getSession();
  if (!s || s.profile.is_suspended) return null;
  return s;
}

/** Adds or changes one variant in the signed-in customer's cart. Prices come from the database, never from the browser. */
export async function setCartQuantity(variantId: string, quantity: number): Promise<CartResult> {
  const session = await shopper();
  if (!session) return { ok: false, needsSignIn: true, message: "Please sign in to use your cart." };
  if (!/^[0-9a-f-]{36}$/.test(variantId) || !Number.isInteger(quantity)) return { ok: false, message: "That isn't a valid quantity." };
  if (!(await withinRateLimit("cartWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { data, error } = await session.supabase.rpc("cart_set_item", { p_variant: variantId, p_quantity: quantity });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/cart");
  return { ok: true, quantity: Number(data), message: Number(data) === 0 ? "Removed from your cart." : "Added to your cart." };
}

export async function clearCart(): Promise<void> {
  const session = await shopper();
  if (!session) return;
  await session.supabase.rpc("cart_clear");
  revalidatePath("/cart");
}

export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await shopper();
  if (!session) return { ok: false, message: "Please sign in to continue." };
  const raw = formValues(formData);
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error), values: raw };
  if (!(await withinRateLimit("cartWrite", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE, values: raw };
  const { error } = await session.supabase.rpc("save_address", { p: parsed.data });
  if (error) return { ok: false, message: friendlyDbError(error), values: raw };
  revalidatePath("/checkout");
  revalidatePath("/dashboard/addresses");
  revalidatePath("/cart");
  return { ok: true, message: "Address saved.", values: {} };
}

export async function deleteAddress(id: string): Promise<void> {
  const session = await shopper();
  if (!session || !/^[0-9a-f-]{36}$/.test(id)) return;
  await session.supabase.rpc("delete_address", { p_id: id });
  revalidatePath("/checkout");
  revalidatePath("/dashboard/addresses");
}

export async function setDefaultAddress(id: string): Promise<void> {
  const session = await shopper();
  if (!session || !/^[0-9a-f-]{36}$/.test(id)) return;
  await session.supabase.rpc("set_default_address", { p_id: id });
  revalidatePath("/checkout");
  revalidatePath("/dashboard/addresses");
  revalidatePath("/cart");
}

/** Submits the unpaid order request. The idempotency key is generated when the checkout page is rendered, so a double click or a retry cannot create a second order. */
export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await shopper();
  if (!session) return { ok: false, message: "Please sign in to continue." };
  const raw = formValues(formData);
  const address = raw.address_id ?? "";
  const key = raw.key ?? "";
  if (!/^[0-9a-f-]{36}$/.test(address)) return { ok: false, message: "Choose a delivery address." };
  if (raw.acknowledge !== "on") return { ok: false, message: "Please confirm that you understand this is an unpaid order request." };
  if (!(await withinRateLimit("checkout", session.user.id))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { data, error } = await session.supabase.rpc("place_order", { p_address: address, p_key: key });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/cart");
  revalidatePath("/dashboard/orders");
  redirect(`/checkout/confirmation/${data}`);
}
