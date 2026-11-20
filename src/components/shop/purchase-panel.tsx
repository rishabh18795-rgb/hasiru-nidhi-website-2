"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Info, MapPin, XCircle } from "lucide-react";

import { checkDelivery, type DeliveryResult } from "@/app/shop/actions";
import { AddToCart } from "@/components/shop/add-to-cart";
import { formatPrice } from "@/lib/format";
import type { PublicProduct } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * Variant choice, price, stock status, the PIN-code delivery check and, while ordering is open, "Add to cart".
 * There is no payment step anywhere: an order is an UNPAID request, and the panel says so.
 */
export function PurchasePanel({ productId, variants, isAvailable, ordersOpen, slug }: { productId: string; variants: PublicProduct["variants"]; isAvailable: boolean; ordersOpen: boolean; slug: string }) {
  const firstInStock = variants.find((v) => v.in_stock) ?? variants[0];
  const [selected, setSelected] = useState(firstInStock?.id);
  const variant = useMemo(() => variants.find((v) => v.id === selected) ?? variants[0], [variants, selected]);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [pending, start] = useTransition();
  if (!variant) return null;
  const status = !isAvailable ? "Currently unavailable" : variant.in_stock ? "In stock" : "Out of stock";

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl text-forest-950" data-testid="product-price">{formatPrice(variant.price_inr)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", status === "In stock" ? "bg-forest-100 text-forest-800" : "bg-stone-200 text-stone-700")}>{status}</span>
          <span className="text-ink/55">Price per item. Taxes and delivery charges are not configured yet.</span>
        </p>
      </div>

      {variants.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-medium text-forest-950">Choose an option</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {variants.map((v) => (
              <label key={v.id} className={cn("cursor-pointer rounded-xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest-500", v.id === variant.id ? "border-forest-700 bg-forest-50" : "border-forest-900/15 bg-white hover:bg-forest-50/50", !v.in_stock && "opacity-70")}>
                <input type="radio" name="variant" value={v.id} checked={v.id === variant.id} onChange={() => setSelected(v.id)} className="sr-only" />
                <span className="block font-medium text-forest-950">{v.name}</span>
                <span className="block text-xs text-ink/60">{formatPrice(v.price_inr)}{!v.in_stock ? " · out of stock" : ""}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {Object.keys(variant.options).length || variant.weight_grams ? (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {Object.entries(variant.options).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-ink/55">{k}:</dt><dd className="text-ink/85">{v}</dd></div>)}
          {variant.weight_grams ? <div className="flex gap-2"><dt className="text-ink/55">Weight:</dt><dd className="text-ink/85">{variant.weight_grams} g</dd></div> : null}
        </dl>
      ) : null}

      <form className="rounded-2xl border border-forest-900/10 bg-white p-4" onSubmit={(e) => { e.preventDefault(); setResult(null); start(async () => setResult(await checkDelivery(productId, pin))); }}>
        <label htmlFor="delivery-pin" className="flex items-center gap-2 text-sm font-medium text-forest-950"><MapPin className="h-4 w-4" aria-hidden="true" /> Check delivery to your PIN code</label>
        <div className="mt-2 flex gap-2">
          <input id="delivery-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="6-digit PIN" className="h-10 w-40 rounded-xl border border-forest-900/15 bg-white px-3 text-sm outline-none focus-visible:border-forest-500 focus-visible:ring-2 focus-visible:ring-forest-500/30" />
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700 disabled:opacity-60">{pending ? "Checking…" : "Check"}</button>
        </div>
        {result ? (
          <p role="status" className={cn("mt-3 flex items-start gap-2 text-sm", result.status === "yes" ? "text-forest-800" : result.status === "no" || !result.ok ? "text-red-700" : "text-ink/70")} data-testid="delivery-result">
            {result.status === "yes" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : result.status === "no" || !result.ok ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            {result.message}
          </p>
        ) : null}
      </form>

      {ordersOpen ? (
        <>
          <AddToCart variantId={variant.id} disabled={!isAvailable || !variant.in_stock} reason={!isAvailable ? "This product is currently unavailable." : !variant.in_stock ? "This option is out of stock." : undefined} signInHref={`/sign-in?next=${encodeURIComponent(`/shop/p/${slug}`)}`} />
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Orders are <strong className="mx-1">unpaid requests</strong>: payment is not configured yet, and nothing is charged. The seller confirms your order and how payment is arranged.</p>
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-sand-50 px-4 py-3 text-sm text-ink/70"><Info className="mt-0.5 h-4 w-4 shrink-0 text-earth-700" aria-hidden="true" /> Ordering is not open yet. You can browse and check delivery now; nothing can be bought or paid for yet.</p>
      )}
    </div>
  );
}
