import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { ORDER_STATUS_SHORT, REQUEST_KIND_LABEL } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { Order, OrderRequest, OrderStatus } from "@/lib/db/types";

export const metadata: Metadata = { title: "Shop orders" };

const VIEWS = [["orders", "Orders"], ["requests", "Requests"], ["disputes", "Disputes"], ["cancellations", "Cancellations"]] as const;
const STATUSES: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered", "rejected", "cancelled"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole(["admin"], "/admin/orders");
  const sp = await searchParams;
  const view = VIEWS.some(([k]) => k === sp.view) ? (sp.view as string) : "orders";
  const status = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : "";
  const term = (sp.q ?? "").replace(/[%,()*\\]/g, " ").trim().slice(0, 60);

  const tabs = (
    <nav aria-label="Views" className="flex flex-wrap gap-2">
      {VIEWS.map(([k, label]) => <Link key={k} href={`/admin/orders?view=${k}`} aria-current={view === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", view === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
    </nav>
  );
  const head = (
    <div>
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Shop orders</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/60">Every product order across all sellers, traceable from the customer checkout to each seller&apos;s order. All orders are unpaid: there is no payment gateway, and no order here is ever recorded as paid.</p>
    </div>
  );

  if (view === "requests" || view === "disputes") {
    if (view === "requests") {
      const { data } = await supabase.from("order_requests").select("*, orders(id, order_number, vendor_name)").order("created_at", { ascending: false }).limit(200);
      const rows = (data ?? []) as unknown as (OrderRequest & { orders: { id: string; order_number: string; vendor_name: string } | null })[];
      return (
        <div className="space-y-6">{head}{tabs}
          {rows.length === 0 ? <EmptyState title="No requests" description="Customer cancellation, return and replacement requests appear here." /> : (
            <Card className="overflow-x-auto p-0"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">When</th></tr></thead>
              <tbody className="divide-y divide-forest-900/8">{rows.map((r) => <tr key={r.id}><td className="px-4 py-3"><Link href={`/admin/orders/${r.order_id}`} className="font-medium text-forest-800 underline">{r.orders?.order_number}</Link></td><td className="px-4 py-3">{r.orders?.vendor_name}</td><td className="px-4 py-3">{REQUEST_KIND_LABEL[r.kind]}<span className="block text-xs text-ink/55">{r.reason}</span></td><td className="px-4 py-3 capitalize">{r.status}</td><td className="px-4 py-3 text-ink/60">{formatDateTime(r.created_at)}</td></tr>)}</tbody></table></Card>
          )}
        </div>
      );
    }
    const { data } = await supabase.from("order_disputes").select("*, orders(id, order_number, vendor_name)").order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as unknown as { id: string; order_id: string; description: string; status: string; resolution: string | null; created_at: string; orders: { order_number: string; vendor_name: string } | null }[];
    return (
      <div className="space-y-6">{head}{tabs}
        {rows.length === 0 ? <EmptyState title="No disputes" description="Disputes opened by customers appear here." /> : (
          <Card className="overflow-x-auto p-0"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Concern</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Opened</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">{rows.map((d) => <tr key={d.id}><td className="px-4 py-3"><Link href={`/admin/orders/${d.order_id}`} className="font-medium text-forest-800 underline">{d.orders?.order_number}</Link></td><td className="px-4 py-3">{d.orders?.vendor_name}</td><td className="px-4 py-3 text-ink/75">{d.description.slice(0, 120)}</td><td className="px-4 py-3 capitalize">{d.status.replace("_", " ")}</td><td className="px-4 py-3 text-ink/60">{formatDateTime(d.created_at)}</td></tr>)}</tbody></table></Card>
        )}
      </div>
    );
  }

  let q = supabase.from("orders").select("*, checkouts(reference)").order("created_at", { ascending: false }).limit(200);
  if (view === "cancellations") q = q.in("status", ["cancelled", "rejected"]);
  else if (status) q = q.eq("status", status);
  if (term) {
    if (/^hn-c-/i.test(term)) {
      const { data: cos } = await supabase.from("checkouts").select("id").ilike("reference", `${term}%`);
      q = q.in("checkout_id", (cos ?? []).map((c) => c.id as string).concat(["00000000-0000-0000-0000-000000000000"]));
    } else q = q.or(`order_number.ilike.%${term}%,vendor_name.ilike.%${term}%,ship_name.ilike.%${term}%`);
  }
  const { data } = await q;
  const orders = (data ?? []) as unknown as (Order & { checkouts: { reference: string } | null })[];

  return (
    <div className="space-y-6">
      {head}{tabs}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value={view} />
        <label className="text-xs text-ink/60">Search<input name="q" defaultValue={term} placeholder="Order number, checkout reference, seller or customer" className="mt-1 block h-10 w-80 max-w-full rounded-xl border border-forest-900/15 bg-white px-3 text-sm" /></label>
        {view === "orders" ? <label className="text-xs text-ink/60">Status<select name="status" defaultValue={status} className="mt-1 block h-10 rounded-xl border border-forest-900/15 bg-white px-3 text-sm"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_SHORT[s]}</option>)}</select></label> : null}
        <button type="submit" className="h-10 rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Filter</button>
      </form>
      {orders.length === 0 ? <EmptyState title="No orders match" description="Orders appear here as soon as a customer submits an order request." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Checkout</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Items total</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Placed</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {orders.map((o) => (
                <tr key={o.id} data-testid="admin-order-row">
                  <td className="px-4 py-3"><Link href={`/admin/orders/${o.id}`} className="font-medium text-forest-800 underline">{o.order_number}</Link></td>
                  <td className="px-4 py-3 text-ink/70">{o.checkouts?.reference}</td>
                  <td className="px-4 py-3">{o.vendor_name}</td>
                  <td className="px-4 py-3">{o.ship_name}<span className="block text-xs text-ink/50">{o.ship_city}</span></td>
                  <td className="px-4 py-3">{ORDER_STATUS_SHORT[o.status]}</td>
                  <td className="px-4 py-3">{formatPrice(o.items_total_inr)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-amber-900">UNPAID</td>
                  <td className="px-4 py-3 text-ink/60">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
