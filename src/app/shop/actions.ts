"use server";

import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RATE_LIMITED_MESSAGE, withinRateLimit } from "@/lib/rate-limit";

export interface DeliveryResult { ok: boolean; status?: "yes" | "no" | "unknown"; message: string }

/** Does this product's seller deliver to a PIN code? Answers only from the seller's own listed coverage; never guesses. */
export async function checkDelivery(productId: string, pin: string): Promise<DeliveryResult> {
  const code = pin.trim();
  if (!/^\d{6}$/.test(code)) return { ok: false, message: "Enter a 6-digit PIN code." };
  if (!/^[0-9a-f-]{36}$/.test(productId) || !isSupabaseConfigured()) return { ok: false, message: "We can't check delivery right now." };
  if (!(await withinRateLimit("deliveryCheck"))) return { ok: false, message: RATE_LIMITED_MESSAGE };
  const { data, error } = await createPublicSupabase(0).rpc("check_product_delivery", { p_product: productId, p_pin: code });
  if (error) return { ok: false, message: "We can't check delivery right now." };
  if (data === "yes") return { ok: true, status: "yes", message: `The seller delivers to ${code}.` };
  if (data === "no") return { ok: true, status: "no", message: `This seller does not deliver to ${code}.` };
  return { ok: true, status: "unknown", message: "This seller hasn't listed their delivery areas yet, so we can't confirm delivery." };
}
