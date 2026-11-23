import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/app/ui";
import { PaymentBadge } from "@/components/orders/payment-notice";
import { requireRole } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Marketplace finance" };

interface OrderRow { id: string; order_number: string; vendor_name: string; status: string; items_total_inr: number | string; shipping_fee_inr: number | string | null; payment_status: string; created_at: string }
interface RequestRow { id: string; request_number: string; vendor_name: string; service_name: string; status: string; agreed_total_inr: number | string | null; payment_status: string; created_at: string }
const sum = (rows: { v: number | string | null }[]) => rows.reduce((t, r) => t + Number(r.v ?? 0), 0);

/** Read-only. Records what has been REQUESTED. Nothing here is revenue: no payment has been taken, and the page says so. */
export default async function AdminMarketplaceFinance() {
  const { supabase } = await requireRole(["admin"], "/admin/marketplace-finance");
  const [{ data: o }, { data: r }, { data: rates }] = await Promise.all([
    supabase.from("orders").select("id, order_number, vendor_name, status, items_total_inr, shipping_fee_inr, payment_status, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("service_requests").select("id, request_number, vendor_name, service_name, status, agreed_total_inr, payment_status, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("marketplace_commission_rates").select("vertical, rate_percent").order("id", { ascending: false }),
  ]);
  const orders = (o ?? []) as OrderRow[];
  const requests = (r ?? []) as RequestRow[];
  const liveOrders = orders.filter((x) => !["rejected", "cancelled"].includes(x.status));
  const liveRequests = requests.filter((x) => !["declined", "cancelled"].includes(x.status) && x.agreed_total_inr !== null);
  const notUnpaid = orders.filter((x) => x.payment_status !== "unpaid").length + requests.filter((x) => x.payment_status !== "unpaid").length;
  const configured = (v: string) => (rates ?? []).some((x) => x.vertical === v && x.rate_percent !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Marketplace finance</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">What customers have asked for, and nothing more. There is no payment gateway, so no money has been taken, no commission has been deducted, no tax has been calculated and there is nothing to pay out. The totals below are requested value, not revenue.</p>
      </div>
      <div role="note" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><PaymentBadge /><p className="mt-2">Integrity check: <strong data-testid="not-unpaid">{notUnpaid}</strong> orders or service requests are marked as anything other than unpaid. This must stay 0 until a real payment workflow has been built and verified.</p></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Shop orders (open or done)", value: String(liveOrders.length) },
          { label: "Requested value of those orders", value: formatPrice(sum(liveOrders.map((x) => ({ v: x.items_total_inr })))) },
          { label: "Service requests with an agreed amount", value: String(liveRequests.length) },
          { label: "Requested value of those services", value: formatPrice(sum(liveRequests.map((x) => ({ v: x.agreed_total_inr })))) },
        ].map((m) => <Card key={m.label}><p className="text-xs text-ink/65">{m.label}</p><p className="mt-1 font-display text-3xl text-forest-950">{m.value}</p></Card>)}
      </div>

      <Card>
        <CardTitle>Commission, tax and payouts</CardTitle>
        <ul className="space-y-1.5 text-sm text-ink/80">
          <li>Product commission: <strong>{configured("products") ? "a rate is recorded (not applied: nothing is paid)" : "UNCONFIGURED"}</strong></li>
          <li>Service commission: <strong>{configured("services") ? "a rate is recorded (not applied: nothing is paid)" : "UNCONFIGURED"}</strong></li>
          <li>Tax (GST) and invoices: <strong>not configured</strong>. None are generated.</li>
          <li>Settlements and payouts: <strong>not available</strong>. Nothing has been paid, so there is nothing to settle.</li>
        </ul>
        <Link href="/admin/marketplace-commission" className="mt-3 inline-block text-sm text-forest-700 underline">Commission settings</Link>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="px-6 pt-6"><CardTitle>Latest shop orders</CardTitle></div>
        {orders.length === 0 ? <p className="px-6 pb-6 text-sm text-ink/65">No orders yet.</p> : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/65"><tr><th className="px-6 py-2">Order</th><th className="px-4 py-2">Seller</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Items</th><th className="px-4 py-2">Delivery fee</th><th className="px-4 py-2">Payment</th><th className="px-4 py-2">Placed</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">{orders.slice(0, 25).map((x) => (
              <tr key={x.id}><td className="px-6 py-2"><Link href={`/admin/orders/${x.id}`} className="text-forest-800 underline">{x.order_number}</Link></td><td className="px-4 py-2">{x.vendor_name}</td><td className="px-4 py-2 capitalize">{x.status}</td><td className="px-4 py-2">{formatPrice(x.items_total_inr)}</td><td className="px-4 py-2 text-ink/65">{x.shipping_fee_inr === null ? "Not configured" : formatPrice(x.shipping_fee_inr)}</td><td className="px-4 py-2 text-xs font-semibold uppercase text-amber-900">{x.payment_status === "unpaid" ? "Unpaid: payment not configured" : x.payment_status}</td><td className="px-4 py-2 text-ink/65">{formatDate(x.created_at)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="px-6 pt-6"><CardTitle>Latest service requests</CardTitle></div>
        {requests.length === 0 ? <p className="px-6 pb-6 text-sm text-ink/65">No service requests yet.</p> : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/65"><tr><th className="px-6 py-2">Request</th><th className="px-4 py-2">Provider</th><th className="px-4 py-2">Service</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">Payment</th><th className="px-4 py-2">Received</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">{requests.slice(0, 25).map((x) => (
              <tr key={x.id}><td className="px-6 py-2"><Link href={`/admin/service-requests/${x.id}`} className="text-forest-800 underline">{x.request_number}</Link></td><td className="px-4 py-2">{x.vendor_name}</td><td className="px-4 py-2">{x.service_name}</td><td className="px-4 py-2 capitalize">{x.status.replace("_", " ")}</td><td className="px-4 py-2">{x.agreed_total_inr === null ? <span className="text-ink/65">No quote yet</span> : formatPrice(x.agreed_total_inr)}</td><td className="px-4 py-2 text-xs font-semibold uppercase text-amber-900">{x.payment_status === "unpaid" ? "Unpaid: payment not configured" : x.payment_status}</td><td className="px-4 py-2 text-ink/65">{formatDate(x.created_at)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
