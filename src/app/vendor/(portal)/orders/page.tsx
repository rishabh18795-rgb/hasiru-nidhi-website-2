import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/app/ui";
import { ProductsGate } from "@/components/vendor/capability-gate";
import { PaymentBadge } from "@/components/orders/payment-notice";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDateTime, formatPrice } from "@/lib/format";
import { ORDER_STATUS_SHORT } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/db/types";

export const metadata: Metadata = { title: "Shop orders" };

const FILTERS = [["new", "Awaiting you"], ["active", "In progress"], ["delivered", "Delivered"], ["closed", "Declined / cancelled"], ["all", "All"]] as const;
const GROUPS: Record<string, string[]> = { new: ["placed"], active: ["confirmed", "packed", "shipped"], delivered: ["delivered"], closed: ["rejected", "cancelled"] };

export default async function VendorOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireUser("/vendor/orders");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "products")) return <ProductsGate ctx={ctx} />;
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "new";
  let q = supabase.from("orders").select("*, order_items(product_name, quantity), order_requests(id, status)").eq("vendor_id", ctx.vendor!.id).order("created_at", { ascending: false }).limit(200);
  if (filter !== "all") q = q.in("status", GROUPS[filter]);
  const { data } = await q;
  const orders = (data ?? []) as unknown as (Order & { order_items: { product_name: string; quantity: number }[]; order_requests: { id: string; status: string }[] })[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Shop orders</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Order requests from customers for your products. Every order is unpaid until you and the customer settle payment directly: online payment is not configured. You only ever see your own orders.</p>
      </div>
      <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => <Link key={k} href={`/vendor/orders?status=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
      </nav>
      {orders.length === 0 ? <EmptyState title="No orders here" description={filter === "new" ? "New order requests appear here, and you are notified when one arrives." : "Nothing matches this filter."} /> : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const open = o.order_requests.filter((r) => r.status === "requested").length;
            return (
              <li key={o.id}>
                <Link href={`/vendor/orders/${o.id}`} className="block rounded-2xl bg-white p-5 ring-1 ring-forest-900/10 hover:shadow-md" data-testid="vendor-order-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-medium text-forest-950">{o.order_number} · {o.ship_name}, {o.ship_city}</p><p className="text-xs text-ink/55">{formatDateTime(o.created_at)}</p><p className="mt-1 truncate text-sm text-ink/70">{o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}</p></div>
                    <div className="flex flex-col items-end gap-1.5"><span className="rounded-full bg-forest-100 px-3 py-0.5 text-xs font-medium text-forest-800">{ORDER_STATUS_SHORT[o.status]}</span>{open ? <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-900">{open} request{open === 1 ? "" : "s"} to review</span> : null}<span className="font-display text-lg text-forest-950">{formatPrice(o.items_total_inr)}</span></div>
                  </div>
                  <div className="mt-3"><PaymentBadge /></div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
