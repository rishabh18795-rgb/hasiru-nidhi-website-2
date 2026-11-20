"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Minus, Plus, Trash2, XCircle } from "lucide-react";

import { setCartQuantity } from "@/app/cart/actions";
import { formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import type { Cart, CartLine } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const ISSUE: Record<string, string> = { unavailable: "No longer available", paused: "Currently unavailable", out_of_stock: "Out of stock", limited_stock: "Less stock than your quantity" };

function Line({ line }: { line: CartLine }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (q: number) => start(async () => { setError(null); const r = await setCartQuantity(line.variant_id, q); if (!r.ok) setError(r.message); window.dispatchEvent(new Event("hn-cart-changed")); router.refresh(); });
  const img = productImageUrl(line.image_path);
  const options = Object.entries(line.options ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
  return (
    <li className={cn("flex gap-4 py-5", pending && "opacity-60")} data-testid="cart-line">
      <Link href={`/shop/p/${line.product_slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-forest-50">{img ? <Image src={img} alt="" fill sizes="96px" className="object-cover" /> : null}</Link>
      <div className="min-w-0 flex-1">
        <Link href={`/shop/p/${line.product_slug}`} className="font-display text-lg leading-snug text-forest-950 hover:underline">{line.product_name}</Link>
        <p className="text-sm text-ink/60">{line.variant_name}{options ? ` · ${options}` : ""}</p>
        <p className="mt-0.5 text-sm text-ink/70">{formatPrice(line.unit_price_inr)} each</p>
        {line.issue ? <p role="alert" className="mt-1 flex items-center gap-1.5 text-sm font-medium text-red-700"><AlertTriangle className="h-4 w-4" aria-hidden="true" />{ISSUE[line.issue]}{line.issue === "limited_stock" ? `: only ${line.max_qty} available` : ""}</p> : null}
        {error ? <p role="alert" className="mt-1 text-sm text-red-700">{error}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-forest-900/20 bg-white" role="group" aria-label={`Quantity of ${line.product_name}`}>
            <button type="button" onClick={() => set(line.quantity - 1)} disabled={pending} aria-label="Decrease quantity" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-forest-50"><Minus className="h-4 w-4" /></button>
            <span className="min-w-8 text-center text-sm font-medium" data-testid="cart-qty">{line.quantity}</span>
            <button type="button" onClick={() => set(line.quantity + 1)} disabled={pending || line.quantity >= line.max_qty} aria-label="Increase quantity" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-forest-50 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-4">
            <p className="font-display text-lg text-forest-950">{formatPrice(line.line_total_inr)}</p>
            <button type="button" onClick={() => set(0)} disabled={pending} aria-label={`Remove ${line.product_name}`} className="rounded-full p-2 text-ink/50 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </li>
  );
}

/** The cart grouped by seller. Each seller becomes its own order at checkout; the delivery badge answers from that seller's own coverage. */
export function CartView({ cart }: { cart: Cart }) {
  const byVendor = new Map<string, CartLine[]>();
  for (const l of cart.lines) byVendor.set(l.vendor_id, [...(byVendor.get(l.vendor_id) ?? []), l]);
  return (
    <div className="space-y-6">
      {cart.vendors.map((v) => (
        <section key={v.vendor_id} className="rounded-3xl bg-white p-5 ring-1 ring-forest-900/10 sm:p-6" aria-label={`Items from ${v.vendor_name}`} data-testid="cart-vendor">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-900/10 pb-3">
            <h2 className="font-display text-xl text-forest-950">Sold by {v.vendor_name}</h2>
            {v.delivery === "yes" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-medium text-forest-800"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Delivers to {cart.pin}</span>
              : v.delivery === "no" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"><XCircle className="h-3.5 w-3.5" aria-hidden="true" />Does not deliver to {cart.pin}</span>
              : v.delivery === "unknown" ? <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">Delivery areas not listed</span> : null}
          </div>
          <ul className="divide-y divide-forest-900/10">{(byVendor.get(v.vendor_id) ?? []).map((l) => <Line key={l.variant_id} line={l} />)}</ul>
          <p className="border-t border-forest-900/10 pt-3 text-right text-sm text-ink/70">Seller subtotal <span className="ml-2 font-display text-lg text-forest-950">{formatPrice(v.subtotal_inr)}</span></p>
        </section>
      ))}
    </div>
  );
}
