import type { Metadata } from "next";
import Link from "next/link";

import { CartView } from "@/components/shop/cart-view";
import { PaymentNotice } from "@/components/orders/payment-notice";
import { ShopNotOpen } from "@/components/shop/shop-notice";
import { LinkButton } from "@/components/site/link-button";
import { requireUser } from "@/lib/auth";
import { getMarketplaceFlags } from "@/lib/flags";
import { formatPrice } from "@/lib/format";
import type { Cart, CustomerAddress } from "@/lib/db/types";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CartPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireUser("/cart");
  if (!(await getMarketplaceFlags()).orders) return <ShopNotOpen />;
  const sp = await searchParams;
  const { data: addrs } = await supabase.from("customer_addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at");
  const addresses = (addrs ?? []) as CustomerAddress[];
  const pin = /^\d{6}$/.test(sp.pin ?? "") ? sp.pin! : addresses[0]?.postal_code ?? null;
  const { data } = await supabase.rpc("get_cart", { p_pin: pin });
  const cart = data as Cart;
  const problems = cart.lines.some((l) => l.issue) || cart.vendors.some((v) => v.delivery === "no");

  return (
    <section className="bg-cream pb-28 pt-32 lg:pb-24">
      <div className="container-nidhi">
        <h1 className="text-4xl font-medium tracking-tight text-forest-950 sm:text-5xl">Your cart</h1>
        {cart.lines.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-forest-900/20 bg-white/60 px-6 py-16 text-center">
            <p className="font-display text-2xl text-forest-950">Your cart is empty</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">Browse the Shop and add products. Items from different sellers can share one cart.</p>
            <div className="mt-6"><LinkButton href="/shop" className="rounded-full bg-forest-800 px-7 text-cream hover:bg-forest-700">Go to the Shop</LinkButton></div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 ring-1 ring-forest-900/10">
                <label className="text-sm font-medium text-forest-950" htmlFor="cart-pin">Check delivery for PIN code
                  <input id="cart-pin" name="pin" inputMode="numeric" maxLength={6} defaultValue={pin ?? ""} className="mt-1.5 block h-10 w-44 rounded-xl border border-forest-900/15 bg-white px-3 text-sm font-normal" />
                </label>
                <button type="submit" className="inline-flex h-10 items-center rounded-full border border-forest-900/20 px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">Check</button>
                <p className="w-full text-xs text-ink/55">One cart can hold items from several sellers. At checkout each seller gets their own order and manages their own delivery.</p>
              </form>
              <CartView cart={cart} />
            </div>
            <aside className="h-fit space-y-4 lg:sticky lg:top-28" aria-label="Order summary">
              <div className="rounded-3xl bg-white p-6 ring-1 ring-forest-900/10">
                <h2 className="font-display text-xl text-forest-950">Summary</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-ink/70">Items ({cart.item_count})</dt><dd className="font-medium">{formatPrice(cart.subtotal_inr)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink/70">Delivery charges</dt><dd className="text-ink/60">Not configured yet</dd></div>
                  <div className="flex justify-between"><dt className="text-ink/70">Taxes</dt><dd className="text-ink/60">Not confirmed yet</dd></div>
                  <div className="flex justify-between border-t border-forest-900/10 pt-3 font-display text-xl text-forest-950"><dt>Items total</dt><dd data-testid="cart-total">{formatPrice(cart.subtotal_inr)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-ink/55">Delivery charges and taxes are not added because they have not been confirmed. The seller will tell you before dispatch.</p>
                <div className="mt-5">
                  {addresses.length === 0 ? (
                    <Link href="/checkout" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-forest-800 text-sm font-medium text-cream hover:bg-forest-700">Continue: add a delivery address</Link>
                  ) : problems ? (
                    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Fix the items marked above, or choose a PIN code that every seller serves, to continue.</p>
                  ) : (
                    <Link href="/checkout" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-forest-800 text-sm font-medium text-cream hover:bg-forest-700">Continue to checkout</Link>
                  )}
                </div>
              </div>
              <PaymentNotice />
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
