import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AddressForm } from "@/components/checkout/address-form";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { PaymentNotice } from "@/components/orders/payment-notice";
import { ShopNotOpen } from "@/components/shop/shop-notice";
import { requireUser } from "@/lib/auth";
import { getMarketplaceFlags } from "@/lib/flags";
import { formatPrice } from "@/lib/format";
import { newIdempotencyKey } from "@/lib/orders";
import { productImageUrl } from "@/lib/images";
import type { Cart, CustomerAddress } from "@/lib/db/types";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireUser("/checkout");
  if (!(await getMarketplaceFlags()).orders) return <ShopNotOpen />;
  const sp = await searchParams;
  const { data: addrs } = await supabase.from("customer_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at");
  const addresses = (addrs ?? []) as CustomerAddress[];
  const selected = addresses.find((a) => a.id === sp.address) ?? addresses[0];
  const { data } = await supabase.rpc("get_cart", { p_pin: selected?.postal_code ?? null });
  const cart = data as Cart;
  if (cart.lines.length === 0) redirect("/cart");

  const issue = cart.lines.find((l) => l.issue);
  const undeliverable = selected ? cart.vendors.filter((v) => v.delivery === "no" || v.delivery === "unknown") : [];
  const blocked = issue ? `${issue.product_name}: please fix this in your cart first.` : undeliverable.length ? `${undeliverable.map((v) => v.vendor_name).join(", ")} ${undeliverable.length === 1 ? "does" : "do"} not deliver to ${selected!.postal_code}. Choose another address or remove ${undeliverable.length === 1 ? "that seller's" : "those sellers'"} items.` : null;

  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi">
        <p className="text-eyebrow">Checkout</p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">Review and submit</h1>
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-8">
            {addresses.length > 0 && selected ? (
              <CheckoutForm addresses={addresses} selectedId={selected.id} idempotencyKey={newIdempotencyKey()} blocked={blocked} />
            ) : (
              <p className="rounded-2xl bg-white p-5 text-sm text-ink/75 ring-1 ring-forest-900/10">Add a delivery address to continue. Sellers deliver only to the PIN codes they serve, so we need it to check delivery.</p>
            )}
            <details className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10" open={addresses.length === 0}>
              <summary className="cursor-pointer font-display text-xl text-forest-950">{addresses.length ? "Add a new address" : "Your delivery address"}</summary>
              <div className="mt-5"><AddressForm submitLabel="Save address" defaultChecked={addresses.length === 0} /></div>
            </details>
            <p className="text-sm text-ink/60"><Link href="/cart" className="underline">Back to your cart</Link></p>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-28" aria-label="Order summary">
            <div className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10">
              <h2 className="font-display text-xl text-forest-950">Your orders</h2>
              <p className="mt-1 text-xs text-ink/55">{cart.vendors.length === 1 ? "1 order, from 1 seller." : `${cart.vendors.length} separate orders, one per seller. Each seller handles their own delivery.`}</p>
              <div className="mt-4 space-y-5">
                {cart.vendors.map((v) => (
                  <div key={v.vendor_id} data-testid="checkout-vendor">
                    <p className="flex items-center justify-between gap-2 text-sm font-medium text-forest-950"><span>{v.vendor_name}</span><span className="font-display text-base">{formatPrice(v.subtotal_inr)}</span></p>
                    <ul className="mt-1.5 space-y-1 text-sm text-ink/70">
                      {cart.lines.filter((l) => l.vendor_id === v.vendor_id).map((l) => <li key={l.variant_id} className="flex items-center gap-2"><span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-forest-50">{productImageUrl(l.image_path) ? <Image src={productImageUrl(l.image_path)!} alt="" fill sizes="32px" className="object-cover" /> : null}</span><span className="min-w-0 flex-1 truncate">{l.quantity} × {l.product_name} ({l.variant_name})</span></li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <dl className="mt-5 space-y-2 border-t border-forest-900/10 pt-4 text-sm">
                <div className="flex justify-between"><dt className="text-ink/70">Delivery charges</dt><dd className="text-ink/60">Not configured yet</dd></div>
                <div className="flex justify-between"><dt className="text-ink/70">Taxes</dt><dd className="text-ink/60">Not confirmed yet</dd></div>
                <div className="flex justify-between font-display text-xl text-forest-950"><dt>Items total</dt><dd>{formatPrice(cart.subtotal_inr)}</dd></div>
              </dl>
            </div>
            <PaymentNotice />
          </aside>
        </div>
      </div>
    </section>
  );
}
