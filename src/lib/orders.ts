import type { OrderRequestKind, OrderStatus, ShipmentStatus } from "@/lib/db/types";

/** The one place the payment state is worded. There is no gateway, so it is always this. Never show "paid" without verified evidence. */
export const PAYMENT_LABEL = "UNPAID: PAYMENT NOT CONFIGURED";
export const PAYMENT_EXPLAINER = "This is an order request. No payment has been taken or recorded, and there is no online payment on this website yet. The seller will confirm how payment is arranged.";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Request sent: waiting for the seller", confirmed: "Accepted by the seller", rejected: "Declined by the seller", packed: "Packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};
export const ORDER_STATUS_SHORT: Record<OrderStatus, string> = { placed: "Awaiting seller", confirmed: "Accepted", rejected: "Declined", packed: "Packed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
export const SHIPMENT_LABEL: Record<ShipmentStatus, string> = { shipped: "Dispatched", in_transit: "In transit", out_for_delivery: "Out for delivery", delivered: "Delivered", failed: "Delivery failed" };
export const REQUEST_KIND_LABEL: Record<OrderRequestKind, string> = { cancel: "Cancellation", return: "Return", replacement: "Replacement" };

/** The steps a customer sees as a timeline, in order. Declined and cancelled orders stop where they stopped. */
export const TIMELINE: OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "delivered"];

/** What the customer may do right now (the database re-checks every rule). */
export function customerActions(status: OrderStatus): { cancel: "now" | "request" | null; returns: boolean } {
  return { cancel: status === "placed" ? "now" : status === "confirmed" || status === "packed" ? "request" : null, returns: status === "delivered" };
}

export function newIdempotencyKey(): string {
  return `co-${crypto.randomUUID()}`;
}
