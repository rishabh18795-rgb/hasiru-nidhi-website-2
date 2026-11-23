import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, StatusBadge } from "@/components/app/ui";
import { PaymentBadge } from "@/components/orders/payment-notice";
import { requireUser } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { ORDER_STATUS_SHORT } from "@/lib/orders";
import type { Order } from "@/lib/db/types";

export const metadata: Metadata = { title: "Shop orders" };

export default async function OrdersPage() {
  const { supabase, user } = await requireUser("/dashboard/orders");
  const { data } = await supabase.from("orders").select("*, checkouts(reference), order_items(product_name, quantity)").eq("customer_id", user.id).order("created_at", { ascending: false });
  const orders = (data ?? []) as unknown as (Order & { checkouts: { reference: string } | null; order_items: { product_name: string; quantity: number }[] })[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Shop orders</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Each seller in a checkout has their own order, so you may see several orders with the same reference. Stay bookings are listed separately.</p>
      </div>
      {orders.length === 0 ? <EmptyState title="No orders yet" description="When you submit an order request from the Shop, it appears here with live status updates." action={{ href: "/shop", label: "Go to the Shop" }} /> : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/dashboard/orders/${o.id}`} className="block rounded-2xl bg-white p-5 ring-1 ring-forest-900/10 transition-shadow hover:shadow-md" data-testid="order-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-950">{o.vendor_name}</p>
                    <p className="text-xs text-ink/65">{o.order_number} · {o.checkouts?.reference} · {formatDate(o.created_at)}</p>
                    <p className="mt-1 truncate text-sm text-ink/70">{o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={o.status === "placed" ? "requested" : o.status === "rejected" || o.status === "cancelled" ? "rejected" : o.status === "delivered" ? "completed" : "confirmed"} />
                    <span className="text-xs font-medium text-ink/70">{ORDER_STATUS_SHORT[o.status]}</span>
                    <span className="font-display text-lg text-forest-950">{formatPrice(o.items_total_inr)}</span>
                  </div>
                </div>
                <div className="mt-3"><PaymentBadge /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
