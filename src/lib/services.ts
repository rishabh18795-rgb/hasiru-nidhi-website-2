import type { ServicePricingModel, ServiceRequestStatus } from "@/lib/db/types";
import { formatPrice } from "@/lib/format";

/** Payment is not configured, so a service request is never shown as paid. The wording is shared with orders (src/lib/orders.ts). */
export const SERVICE_PAYMENT_EXPLAINER = "This is a service request. No payment has been taken or recorded, and there is no online payment on this website yet. The provider will confirm how payment is arranged.";

export const PRICE_UNITS = [
  { value: "visit", label: "per visit" }, { value: "hour", label: "per hour" }, { value: "day", label: "per day" }, { value: "sq_ft", label: "per sq ft" },
  { value: "plant", label: "per plant" }, { value: "session", label: "per session" }, { value: "job", label: "per job" },
] as const;
export const PRICE_UNIT_TEXT: Record<string, string> = Object.fromEntries(PRICE_UNITS.map((u) => [u.value, u.label]));
export const UNIT_NOUN: Record<string, string> = { visit: "visits", hour: "hours", day: "days", sq_ft: "sq ft", plant: "plants", session: "sessions", job: "jobs" };

export const PRICING_LABEL: Record<ServicePricingModel, string> = { fixed: "Fixed price", quote: "Quotation on request" };

/** "₹500 per visit" for fixed-price listings, "Quotation on request" otherwise. Never an invented number. */
export function servicePriceText(model: ServicePricingModel, price: number | string | null, unit: string | null): string {
  if (model === "quote" || price === null || price === "") return PRICING_LABEL.quote;
  return `${formatPrice(price)}${unit ? ` ${PRICE_UNIT_TEXT[unit] ?? ""}` : ""}`.trim();
}

export function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const REQUEST_STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  submitted: "Request sent: waiting for the provider", quoted: "Quotation received: your decision", accepted: "Accepted: agreed", in_progress: "Work in progress", completed: "Completed", declined: "Declined by the provider", cancelled: "Cancelled",
};
export const REQUEST_STATUS_SHORT: Record<ServiceRequestStatus, string> = {
  submitted: "Awaiting provider", quoted: "Quotation sent", accepted: "Accepted", in_progress: "In progress", completed: "Completed", declined: "Declined", cancelled: "Cancelled",
};
export const REQUEST_TIMELINE: ServiceRequestStatus[] = ["submitted", "accepted", "in_progress", "completed"];
export const TIMELINE_QUOTED: ServiceRequestStatus[] = ["submitted", "quoted", "accepted", "in_progress", "completed"];

export const SERVICE_STATUS_COPY: Record<string, string> = {
  draft: "Draft: only you can see it. Complete it and submit for review.",
  pending_review: "Waiting for our team to review it. You can't edit it until the review is finished.",
  approved: "Approved and live when Services is open. Changing its details, price or photos sends it back for review.",
  rejected: "Not approved. Read the note, fix it and submit again.",
  suspended: "Suspended by our team. Contact support to resolve this.",
  archived: "Archived: hidden from customers. Restore it to start again as a draft.",
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function newServiceKey(): string {
  return `sr-${crypto.randomUUID()}`;
}

/** An instant in India as the value of a datetime-local field (YYYY-MM-DDTHH:MM) and back. The database evaluates availability in IST. */
export function istLocalToIso(local: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00+05:30` : null;
}
