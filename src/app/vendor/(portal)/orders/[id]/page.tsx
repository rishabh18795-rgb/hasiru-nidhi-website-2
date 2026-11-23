import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, DefinitionList } from "@/components/app/ui";
import { ProductsGate } from "@/components/vendor/capability-gate";
import { PackedButton, RequestDecisionForm, RespondOrderForm, ShipForm, ShipmentUpdateForm } from "@/components/vendor/order-forms";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { PaymentNotice } from "@/components/orders/payment-notice";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDateTime, formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { ORDER_STATUS_LABEL, REQUEST_KIND_LABEL, SHIPMENT_LABEL } from "@/lib/orders";
import type { Order, OrderHistoryRow, OrderItem, OrderRequest, Shipment } from "@/lib/db/types";

export const metadata: Metadata = { title: "Order" };

interface ShippingRow { ship_phone: string; ship_line1: string; ship_line2: string | null; ship_landmark: string | null }

export default async function VendorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/vendor/orders/${id}`);
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "products")) return <ProductsGate ctx={ctx} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: o } = await supabase.from("orders").select("*").eq("id", id).eq("vendor_id", ctx.vendor!.id).maybeSingle();
  if (!o) notFound();
  const order = o as Order;
  const [{ data: it }, { data: sh }, { data: shp }, { data: hi }, { data: rq }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("shipments").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("order_shipping").select("ship_phone, ship_line1, ship_line2, ship_landmark").eq("order_id", id).maybeSingle(),
    supabase.from("order_status_history").select("id, from_status, to_status, actor_kind, note, created_at").eq("order_id", id).order("id"),
    supabase.from("order_requests").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  const items = (it ?? []) as OrderItem[];
  const shipment = sh as Shipment | null;
  const shipping = shp as ShippingRow | null;
  const history = (hi ?? []) as OrderHistoryRow[];
  const requests = (rq ?? []) as OrderRequest[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor/orders" className="text-sm text-forest-700 underline">← All orders</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">{order.order_number}</h1>
        <p className="mt-1 text-sm text-ink/65">Placed {formatDateTime(order.created_at)} · {ORDER_STATUS_LABEL[order.status]}</p>
      </div>
      <Card><OrderTimeline status={order.status} /></Card>
      <PaymentNotice />

      {order.status === "placed" ? <Card><CardTitle>Accept or decline</CardTitle><RespondOrderForm orderId={order.id} /></Card> : null}
      {order.status === "confirmed" ? <Card><CardTitle>Prepare the order</CardTitle><p className="mb-3 text-sm text-ink/70">Pack the items, then mark the order as packed. Then add the courier and tracking number to dispatch it.</p><PackedButton orderId={order.id} /></Card> : null}
      {order.status === "packed" ? <Card><CardTitle>Dispatch</CardTitle><p className="mb-3 text-sm text-ink/70">Enter the courier and tracking number. You handle your own shipping; the customer will see these details.</p><ShipForm orderId={order.id} /></Card> : null}
      {order.status === "shipped" && shipment ? (
        <Card>
          <CardTitle>Shipment</CardTitle>
          <DefinitionList items={[{ label: "Carrier", value: shipment.carrier }, { label: "Tracking number", value: shipment.tracking_number }, { label: "Status", value: SHIPMENT_LABEL[shipment.status] }, { label: "Dispatched", value: formatDateTime(shipment.shipped_at) }]} />
          <div className="mt-4"><ShipmentUpdateForm orderId={order.id} /></div>
        </Card>
      ) : shipment ? (
        <Card><CardTitle>Shipment</CardTitle><DefinitionList items={[{ label: "Carrier", value: shipment.carrier }, { label: "Tracking number", value: shipment.tracking_number }, { label: "Status", value: SHIPMENT_LABEL[shipment.status] }, { label: "Delivered", value: shipment.delivered_at ? formatDateTime(shipment.delivered_at) : null }]} /></Card>
      ) : null}

      <Card>
        <CardTitle>Items</CardTitle>
        <ul className="divide-y divide-forest-900/10">
          {items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-forest-50">{productImageUrl(i.image_path) ? <Image src={productImageUrl(i.image_path)!} alt="" fill sizes="64px" className="object-cover" /> : null}</span>
              <div className="min-w-0 flex-1"><p className="font-medium text-forest-950">{i.product_name}</p><p className="text-sm text-ink/65">{i.variant_name} · SKU {i.sku} · {formatPrice(i.unit_price_inr)} × {i.quantity}</p></div>
              <p className="font-display text-lg text-forest-950">{formatPrice(i.line_total_inr)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-forest-900/10 pt-3 text-sm"><span className="text-ink/70">Items total (delivery charges and taxes are not configured)</span><span className="font-display text-lg text-forest-950">{formatPrice(order.items_total_inr)}</span></div>
      </Card>

      <Card>
        <CardTitle>Customer delivery details</CardTitle>
        {shipping ? (
          <p className="text-sm leading-relaxed text-ink/80" data-testid="vendor-customer-address">{order.ship_name}, {shipping.ship_phone}<br />{[shipping.ship_line1, shipping.ship_line2, shipping.ship_landmark].filter(Boolean).join(", ")}<br />{order.ship_city}, {order.ship_state} {order.ship_postal_code}</p>
        ) : (
          <>
            <p className="text-sm text-ink/80">{order.ship_name}, {order.ship_city}, {order.ship_state} {order.ship_postal_code}</p>
            <p className="mt-2 text-xs text-ink/65">{order.status === "placed" ? "The customer's phone number and full address are shown after you accept the order." : "Full delivery details are only shown while an order is accepted."}</p>
          </>
        )}
      </Card>

      {requests.length ? (
        <Card>
          <CardTitle>Customer requests</CardTitle>
          <ul className="divide-y divide-forest-900/10 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="space-y-2 py-3">
                <p className="font-medium text-forest-950">{REQUEST_KIND_LABEL[r.kind]} request: <span className="capitalize">{r.status}</span> <span className="text-xs font-normal text-ink/65">{formatDateTime(r.created_at)}</span></p>
                <p className="text-ink/75">{r.reason}</p>
                {r.details ? <p className="text-ink/65">{r.details}</p> : null}
                {r.policy_note ? <p className="text-xs text-ink/65">{r.policy_note}</p> : null}
                {r.decision_note ? <p className="text-xs text-ink/70">Decision note: {r.decision_note}</p> : null}
                <RequestDecisionForm requestId={r.id} orderId={order.id} kind={r.kind} status={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Status history</CardTitle>
        <ol className="space-y-2 text-sm">{history.map((h) => <li key={h.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-medium text-forest-950">{ORDER_STATUS_LABEL[h.to_status]}</span><span className="text-ink/65"> · by {h.actor_kind}</span>{h.note ? <span className="text-ink/65"> · {h.note}</span> : null}</span><span className="text-xs text-ink/65">{formatDateTime(h.created_at)}</span></li>)}</ol>
      </Card>
    </div>
  );
}
