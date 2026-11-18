import type { BookingFinancial, HostSettlement } from "@/lib/db/types";

export interface WalletSummary {
  /** Host share of confirmed and completed bookings, after cancellation / refund reversals. */
  totalEarnings: number;
  /** Earned but not yet eligible: confirmed stays not completed, or completed with no payment recorded. */
  pendingEarnings: number;
  /** Completed, payment recorded, not yet in any settlement. Informational: the host cannot withdraw it. */
  readyForSettlement: number;
  /** Settlements prepared by the team that are pending, processing or on hold. */
  inSettlement: number;
  /** Settlements marked paid (with a bank reference by the admin). */
  paidOut: number;
  /** Platform commission on those bookings, net of reversals. */
  commission: number;
  completedStays: number;
  confirmedBookings: number;
}

const n = (v: unknown) => Number(v ?? 0);

/**
 * Pure and deterministic: the same rows always give the same wallet. Amounts come only from booking_financials (one row per booking) and
 * host_settlements; nothing is stored as a balance. A booking counts as "ready" only when it is completed AND its payment is recorded
 * (the platform's default settlement rule) and it is not already part of a settlement.
 */
export function summarizeWallet(rows: Pick<BookingFinancial, "status" | "payment_status" | "settlement_status" | "net_host_share_inr" | "net_commission_inr">[], settlements: Pick<HostSettlement, "status" | "amount_inr">[]): WalletSummary {
  const earning = rows.filter((b) => b.status === "confirmed" || b.status === "completed");
  const inASettlement = (b: (typeof rows)[number]) => b.settlement_status !== "not_due";
  const isReady = (b: (typeof rows)[number]) =>
    b.status === "completed" && !inASettlement(b) && (b.payment_status === "paid" || b.payment_status === "partially_refunded") && n(b.net_host_share_inr) > 0;
  const sum = (list: typeof rows, f: (b: (typeof rows)[number]) => number) => list.reduce((t, b) => t + f(b), 0);
  const ready = earning.filter(isReady);
  const pending = earning.filter((b) => !inASettlement(b) && !isReady(b));
  return {
    totalEarnings: sum(earning, (b) => n(b.net_host_share_inr)),
    pendingEarnings: sum(pending, (b) => n(b.net_host_share_inr)),
    readyForSettlement: sum(ready, (b) => n(b.net_host_share_inr)),
    inSettlement: settlements.filter((s) => ["pending", "processing", "on_hold"].includes(s.status)).reduce((t, s) => t + n(s.amount_inr), 0),
    paidOut: settlements.filter((s) => s.status === "paid").reduce((t, s) => t + n(s.amount_inr), 0),
    commission: sum(earning, (b) => n(b.net_commission_inr)),
    completedStays: rows.filter((b) => b.status === "completed").length,
    confirmedBookings: rows.filter((b) => b.status === "confirmed").length,
  };
}
