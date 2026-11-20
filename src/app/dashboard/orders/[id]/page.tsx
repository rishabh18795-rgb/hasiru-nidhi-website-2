import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Truck } from "lucide-react";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { CancelOrderForm, DisputeForm, ReturnForm } from "@/components/orders/order-actions";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { PaymentNotice } from "@/components/orders/payment-notice";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { ORDER_STATUS_LABEL, REQUEST_KIND_LABEL, SHIPMENT_LABEL, customerActions } from "@/lib/orders";
import type { CategoryPolicy, Checkout, Order, OrderDispute, OrderHistoryRow, OrderItem, OrderRequest, Shipment } from "@/lib/db/types";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/dashboard/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: o } = await supabase.from("orders").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!o) notFound();
  const order = o as Order;
  const [{ data: it }, { data: sh }, { data: hi }, { data: rq }, { data: ds }, { data: co }, { data: sib }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("shipments").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("order_status_history").select("id, from_status, to_status, actor_kind, note, created_at").eq("order_id", id).order("id"),
    supabase.from("order_requests").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_disputes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("checkouts").select("*").eq("id", order.checkout_id).maybeSingle(),
    supabase.from("orders").select("id, order_number, vendor_name, status").eq("checkout_id", order.checkout_id).neq("id", id),
  ]);
  const items = (it ?? []) as OrderItem[];
  const shipment = sh as Shipment | null;
  const history = (hi ?? []) as OrderHistoryRow[];
  const requests = (rq ?? []) as OrderRequest[];
  const disputes = (ds ?? []) as OrderDispute[];
  const checkout = co as Checkout | null;
  const siblings = (sib ?? []) as Pick<Order, "id" | "order_number" | "vendor_name" | "status">[];
  const { data: pol } = await supabase.from("product_category_policies").select("*").in("category_id", [...new Set(items.map((i) => i.category_id))]);
  const policies = (pol ?? []) as CategoryPolicy[];
  const can = customerActions(order.status);
  const openRequest = (k: string) => requests.some((r) => r.kind === k && (r.status === "requested" || r.status === "approved"));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/orders" className="text-sm text-forest-700 underline">← All orders</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{order.order_number}</h1><StatusBadge status={order.status === "placed" ? "requested" : order.status === "rejected" || order.status === "cancelled" ? "rejected" : order.status === "delivered" ? "completed" : "confirmed"} /></div>
        <p className="mt-1 text-sm text-ink/60">Sold by {order.vendor_name} · Checkout {checkout?.reference} · Placed {formatDateTime(order.created_at)}</p>
      </div>

      <Card><OrderTimeline status={order.status} /><p className="mt-4 text-sm text-ink/70">{ORDER_STATUS_LABEL[order.status]}{order.rejection_reason ? `: ${order.rejection_reason}` : ""}{order.status === "cancelled" && order.cancel_reason ? `: ${order.cancel_reason}` : ""}</p></Card>
      <PaymentNotice />

      {shipment ? (
        <Card>
          <CardTitle>Shipment</CardTitle>
          <p className="flex items-center gap-2 text-sm font-medium text-forest-950"><Truck className="h-4 w-4" aria-hidden="true" />{SHIPMENT_LABEL[shipment.status]}</p>
          <DefinitionList items={[{ label: "Carrier", value: shipment.carrier }, { label: "Tracking number", value: <span data-testid="tracking-number">{shipment.tracking_number}</span> }, { label: "Dispatched", value: formatDateTime(shipment.shipped_at) }, { label: "Delivered", value: shipment.delivered_at ? formatDateTime(shipment.delivered_at) : null }]} />
          {shipment.tracking_url ? <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-forest-700 underline">Track with the carrier <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : null}
          <p className="mt-3 text-xs text-ink/55">Tracking is entered by the seller. Hasiru Nidhi does not run the delivery.</p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Items</CardTitle>
        <ul className="divide-y divide-forest-900/10">
          {items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-forest-50">{productImageUrl(i.image_path) ? <Image src={productImageUrl(i.image_path)!} alt="" fill sizes="64px" className="object-cover" /> : null}</span>
              <div className="min-w-0 flex-1"><Link href={`/shop/p/${i.product_slug}`} className="font-medium text-forest-950 hover:underline">{i.product_name}</Link><p className="text-sm text-ink/60">{i.variant_name} · {formatPrice(i.unit_price_inr)} × {i.quantity}</p></div>
              <p className="font-display text-lg text-forest-950">{formatPrice(i.line_total_inr)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-forest-900/10 pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink/70">Items total</dt><dd className="font-medium">{formatPrice(order.items_total_inr)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink/70">Delivery charges</dt><dd className="text-ink/60">{order.shipping_fee_inr === null ? "Not configured: the seller will confirm" : formatPrice(order.shipping_fee_inr)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink/70">Taxes</dt><dd className="text-ink/60">{order.tax_inr === null ? "Not confirmed yet" : formatPrice(order.tax_inr)}</dd></div>
        </dl>
      </Card>

      {checkout ? <Card><CardTitle>Delivery address</CardTitle><p className="text-sm leading-relaxed text-ink/80">{checkout.ship_name}, {checkout.ship_phone}<br />{[checkout.ship_line1, checkout.ship_line2, checkout.ship_landmark].filter(Boolean).join(", ")}<br />{checkout.ship_city}, {checkout.ship_state} {checkout.ship_postal_code}</p></Card> : null}
      {siblings.length ? <Card><CardTitle>Other orders in this checkout</CardTitle><ul className="space-y-1.5 text-sm">{siblings.map((s) => <li key={s.id}><Link href={`/dashboard/orders/${s.id}`} className="text-forest-700 underline">{s.order_number}</Link> · {s.vendor_name} · {s.status}</li>)}</ul></Card> : null}

      {can.cancel ? <Card><CardTitle>Cancel</CardTitle>{openRequest("cancel") ? <p className="text-sm text-ink/70">Your cancellation request is waiting for the seller.</p> : <CancelOrderForm orderId={order.id} mode={can.cancel} />}</Card> : null}

      {can.returns ? (
        <Card>
          <CardTitle>Return or replacement</CardTitle>
          <div className="mb-4 space-y-1 text-sm text-ink/70" data-testid="policy-summary">
            {policies.length === 0 ? <p>No return or replacement policy has been set for these products yet. You can still send a request: the seller and our team will decide, and we will tell you how it was decided.</p> : policies.map((p) => <p key={p.category_id}>{p.returns_allowed === null ? "Returns: not decided yet" : p.returns_allowed ? `Returns accepted${p.return_window_days ? ` within ${p.return_window_days} days of delivery` : ""}` : "Returns not accepted"}; {p.replacements_allowed === null ? "replacements not decided yet" : p.replacements_allowed ? `replacements accepted${p.replacement_window_days ? ` within ${p.replacement_window_days} days` : ""}` : "replacements not accepted"}.{p.notes ? ` ${p.notes}` : ""}</p>)}
          </div>
          {openRequest("return") && openRequest("replacement") ? <p className="text-sm text-ink/70">You already have open return and replacement requests for this order.</p> : <ReturnForm orderId={order.id} />}
        </Card>
      ) : null}

      {requests.length ? (
        <Card>
          <CardTitle>Your requests</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">
            {requests.map((r) => <li key={r.id} className="space-y-1 py-3"><p className="font-medium text-forest-950">{REQUEST_KIND_LABEL[r.kind]}: <span className="capitalize">{r.status}</span></p><p className="text-ink/70">{r.reason}</p>{r.policy_note ? <p className="text-xs text-ink/55">{r.policy_note}</p> : null}{r.decision_note ? <p className="text-xs text-ink/70">Decision note: {r.decision_note}</p> : null}</li>)}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Status history</CardTitle>
        <ol className="space-y-2 text-sm">
          {history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-medium text-forest-950">{ORDER_STATUS_LABEL[h.to_status]}</span>{h.note ? <span className="text-ink/60"> · {h.note}</span> : null}</span><span className="text-xs text-ink/50">{formatDateTime(h.created_at)}</span></li>)}
        </ol>
      </Card>

      <Card>
        <CardTitle>Something wrong?</CardTitle>
        {disputes.length ? <ul className="mb-4 space-y-2 text-sm">{disputes.map((d) => <li key={d.id} className="rounded-xl bg-forest-50 p-3"><span className="font-medium capitalize">{d.status.replace("_", " ")}</span>: {d.description}{d.resolution ? <span className="mt-1 block text-ink/70">Resolution: {d.resolution}</span> : null}</li>)}</ul> : null}
        <p className="mb-3 text-sm text-ink/70">If the seller is not responding or you have a problem with this order, tell our team.</p>
        <DisputeForm orderId={order.id} />
      </Card>
    </div>
  );
}
