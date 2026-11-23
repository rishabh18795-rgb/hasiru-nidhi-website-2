import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, DefinitionList } from "@/components/app/ui";
import { AdminCancelForm, AdminRequestForm, DisputeResolveForm } from "@/components/admin/order-forms";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { PaymentNotice } from "@/components/orders/payment-notice";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, ORDER_STATUS_SHORT, REQUEST_KIND_LABEL, SHIPMENT_LABEL } from "@/lib/orders";
import type { Checkout, Order, OrderDispute, OrderHistoryRow, OrderItem, OrderRequest, Shipment } from "@/lib/db/types";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole(["admin"], `/admin/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: o } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();
  const order = o as Order;
  const [{ data: co }, { data: sib }, { data: it }, { data: shp }, { data: sh }, { data: hi }, { data: rq }, { data: ds }, { data: cust }, { data: audit }, { data: mv }] = await Promise.all([
    supabase.from("checkouts").select("*").eq("id", order.checkout_id).maybeSingle(),
    supabase.from("orders").select("id, order_number, vendor_name, status, items_total_inr").eq("checkout_id", order.checkout_id).order("created_at"),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_shipping").select("ship_phone, ship_line1, ship_line2, ship_landmark").eq("order_id", id).maybeSingle(),
    supabase.from("shipments").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("order_status_history").select("id, from_status, to_status, actor_kind, note, created_at").eq("order_id", id).order("id"),
    supabase.from("order_requests").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_disputes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("full_name, email").eq("id", order.customer_id).maybeSingle(),
    supabase.from("audit_logs").select("id, action, created_at").eq("entity_type", "order").eq("entity_id", id).order("id", { ascending: false }).limit(20),
    supabase.from("inventory_movements").select("id, delta, balance_after, reason, created_at").eq("order_id", id).order("id"),
  ]);
  const checkout = co as Checkout | null;
  const siblings = (sib ?? []) as Pick<Order, "id" | "order_number" | "vendor_name" | "status" | "items_total_inr">[];
  const items = (it ?? []) as OrderItem[];
  const shipping = shp as { ship_phone: string; ship_line1: string; ship_line2: string | null; ship_landmark: string | null } | null;
  const shipment = sh as Shipment | null;
  const history = (hi ?? []) as OrderHistoryRow[];
  const requests = (rq ?? []) as OrderRequest[];
  const disputes = (ds ?? []) as OrderDispute[];
  const cancellable = ["placed", "confirmed", "packed"].includes(order.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-forest-700 underline">← All orders</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">{order.order_number}</h1>
        <p className="mt-1 text-sm text-ink/65">{ORDER_STATUS_LABEL[order.status]} · Placed {formatDateTime(order.created_at)}</p>
      </div>
      <Card><OrderTimeline status={order.status} /></Card>

      <Card>
        <CardTitle>Trace: customer checkout to seller orders</CardTitle>
        <DefinitionList items={[
          { label: "Checkout reference", value: <span data-testid="admin-checkout-ref">{checkout?.reference}</span> },
          { label: "Customer", value: [cust?.full_name, cust?.email].filter(Boolean).join(" · ") },
          { label: "Seller", value: <Link href={`/admin/vendors/${order.vendor_id}`} className="underline">{order.vendor_name}</Link> },
          { label: "Checkout total", value: checkout ? `${formatPrice(checkout.items_total_inr)} across ${checkout.order_count} order${checkout.order_count === 1 ? "" : "s"}` : null },
        ]} />
        <ul className="mt-4 space-y-1.5 text-sm">
          {siblings.map((s) => <li key={s.id} className={s.id === id ? "font-medium text-forest-950" : ""}>{s.id === id ? "▸ " : ""}<Link href={`/admin/orders/${s.id}`} className="text-forest-700 underline">{s.order_number}</Link> · {s.vendor_name} · {ORDER_STATUS_SHORT[s.status]} · {formatPrice(s.items_total_inr)}</li>)}
        </ul>
      </Card>

      <Card>
        <CardTitle>Financial breakdown</CardTitle>
        <DefinitionList items={[
          { label: "Items total", value: formatPrice(order.items_total_inr) },
          { label: "Delivery charges", value: order.shipping_fee_inr === null ? "Not configured (none charged)" : formatPrice(order.shipping_fee_inr) },
          { label: "Taxes", value: order.tax_inr === null ? "Not confirmed (none added)" : formatPrice(order.tax_inr) },
          { label: "Payment", value: <span data-testid="admin-payment-status">UNPAID: PAYMENT NOT CONFIGURED</span> },
          { label: "Marketplace commission", value: "Not configured: no rate has been approved for products" },
          { label: "Seller settlement", value: "Not applicable until payment and commission are configured" },
        ]} />
      </Card>
      <PaymentNotice />

      <Card>
        <CardTitle>Items</CardTitle>
        <ul className="divide-y divide-forest-900/10 text-sm">{items.map((i) => <li key={i.id} className="flex justify-between gap-3 py-3"><span>{i.product_name} <span className="text-ink/65">({i.variant_name}, SKU {i.sku}) · {formatPrice(i.unit_price_inr)} × {i.quantity}</span></span><span className="font-medium">{formatPrice(i.line_total_inr)}</span></li>)}</ul>
        {(mv ?? []).length ? <p className="mt-3 text-xs text-ink/65">Stock movements: {(mv ?? []).map((m) => `${m.delta > 0 ? "+" : ""}${m.delta} (${String(m.reason).replace("_", " ")})`).join(", ")}</p> : null}
      </Card>

      <Card>
        <CardTitle>Delivery</CardTitle>
        <p className="text-sm text-ink/80">{order.ship_name}{shipping ? `, ${shipping.ship_phone}` : ""}<br />{shipping ? [shipping.ship_line1, shipping.ship_line2, shipping.ship_landmark].filter(Boolean).join(", ") : null}{shipping ? <br /> : null}{order.ship_city}, {order.ship_state} {order.ship_postal_code}</p>
        {shipment ? <p className="mt-3 text-sm text-ink/80">Shipment: {SHIPMENT_LABEL[shipment.status]} · {shipment.carrier} · tracking {shipment.tracking_number}</p> : <p className="mt-3 text-sm text-ink/65">Not shipped yet.</p>}
      </Card>

      {requests.length ? (
        <Card>
          <CardTitle>Requests</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">
            {requests.map((r) => <li key={r.id} className="space-y-2 py-3"><p className="font-medium text-forest-950">{REQUEST_KIND_LABEL[r.kind]}: <span className="capitalize">{r.status}</span> <span className="text-xs font-normal text-ink/65">{formatDateTime(r.created_at)}</span></p><p className="text-ink/75">{r.reason}</p>{r.policy_note ? <p className="text-xs text-ink/65">{r.policy_note}</p> : null}{r.decision_note ? <p className="text-xs text-ink/70">Decision: {r.decision_note}</p> : null}<AdminRequestForm requestId={r.id} orderId={order.id} kind={r.kind} status={r.status} /></li>)}
          </ul>
        </Card>
      ) : null}

      {disputes.length ? (
        <Card>
          <CardTitle>Disputes</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">
            {disputes.map((d) => <li key={d.id} className="space-y-2 py-3"><p className="font-medium capitalize text-forest-950">{d.status.replace("_", " ")} <span className="text-xs font-normal text-ink/65">{formatDateTime(d.created_at)}</span></p><p className="text-ink/75">{d.description}</p>{d.resolution ? <p className="text-xs text-ink/70">Resolution: {d.resolution}</p> : null}<DisputeResolveForm disputeId={d.id} orderId={order.id} status={d.status} /></li>)}
          </ul>
        </Card>
      ) : null}

      {cancellable ? <Card><CardTitle>Cancel this order</CardTitle><AdminCancelForm orderId={order.id} /></Card> : null}

      <Card>
        <CardTitle>Status history</CardTitle>
        <ol className="space-y-2 text-sm">{history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-medium text-forest-950">{ORDER_STATUS_LABEL[h.to_status]}</span><span className="text-ink/65"> · by {h.actor_kind}</span>{h.note ? <span className="text-ink/65"> · {h.note}</span> : null}</span><span className="text-xs text-ink/65">{formatDateTime(h.created_at)}</span></li>)}</ol>
        {(audit ?? []).length ? <p className="mt-4 text-xs text-ink/65">Audit log: {(audit ?? []).map((a) => String(a.action).replace(/_/g, " ")).join(" · ")}</p> : null}
      </Card>
    </div>
  );
}
