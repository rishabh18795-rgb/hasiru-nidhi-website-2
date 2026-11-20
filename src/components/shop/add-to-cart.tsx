"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";

import { setCartQuantity } from "@/app/cart/actions";

/** Quantity and "Add to cart" for one variant. Only rendered while ordering is open; the database rechecks stock, price and availability. */
export function AddToCart({ variantId, disabled, reason, signInHref }: { variantId: string; disabled: boolean; reason?: string; signInHref: string }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    const r = await setCartQuantity(variantId, qty);
    if (r.needsSignIn) { router.push(signInHref); return; }
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) { window.dispatchEvent(new Event("hn-cart-changed")); router.refresh(); }
  });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-full border border-forest-900/20 bg-white" role="group" aria-label="Quantity">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || disabled} aria-label="Decrease quantity" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-forest-50 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
          <span className="min-w-8 text-center text-sm font-medium" aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99 || disabled} aria-label="Increase quantity" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-forest-50 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={add} disabled={disabled || pending} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700 disabled:opacity-50 sm:flex-none">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {pending ? "Adding…" : "Add to cart"}
        </button>
      </div>
      {disabled && reason ? <p className="text-sm text-ink/60">{reason}</p> : null}
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`flex items-center gap-1.5 text-sm ${msg.ok ? "text-forest-800" : "text-red-700"}`}>{msg.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : null}{msg.text}{msg.ok ? <> <a href="/cart" className="underline">View cart</a></> : null}</p> : null}
    </div>
  );
}
