import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { PaymentBadge, PaymentNotice } from "@/components/orders/payment-notice";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Checkout, Order } from "@/lib/db/types";

export const metadata: Metadata = { title: "Order request sent", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser(`/checkout/confirmation/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: c } = await supabase.from("checkouts").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const checkout = c as Checkout;
  const { data: o } = await supabase.from("orders").select("*").eq("checkout_id", id).order("created_at");
  const orders = (o ?? []) as Order[];
  return (
    <section className="bg-cream pb-24 pt-32">
      <div className="container-nidhi max-w-3xl">
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-forest-900/10">
          <CheckCircle2 className="mx-auto h-12 w-12 text-forest-700" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-medium tracking-tight text-forest-950 sm:text-4xl">Order request sent</h1>
          <p className="mt-2 text-ink/70">Reference <strong data-testid="checkout-reference">{checkout.reference}</strong></p>
          <div className="mt-4 flex justify-center"><PaymentBadge /></div>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ink/70">We sent your request to {checkout.order_count} seller{checkout.order_count === 1 ? "" : "s"}. Nothing has been paid or charged. Each seller will accept or decline their part, and you can follow every update here.</p>
        </div>
        <div className="mt-6 space-y-3">
          {orders.map((ord) => (
            <Link key={ord.id} href={`/dashboard/orders/${ord.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-forest-900/10 hover:shadow-md" data-testid="confirmation-order">
              <span><span className="block font-medium text-forest-950">{ord.vendor_name}</span><span className="text-sm text-ink/60">{ord.order_number} · {ORDER_STATUS_LABEL[ord.status]}</span></span>
              <span className="font-display text-lg text-forest-950">{formatPrice(ord.items_total_inr)}</span>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-right text-sm text-ink/70">Items total <span className="ml-2 font-display text-xl text-forest-950">{formatPrice(checkout.items_total_inr)}</span></p>
        <div className="mt-6"><PaymentNotice /></div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard/orders" className="inline-flex h-11 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">View my orders</Link>
          <Link href="/shop" className="inline-flex h-11 items-center rounded-full border border-forest-900/20 bg-white px-6 text-sm font-medium text-forest-900 hover:bg-forest-50">Continue shopping</Link>
        </div>
      </div>
    </section>
  );
}
