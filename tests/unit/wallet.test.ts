import { describe, expect, it } from "vitest";

import { summarizeWallet } from "@/lib/wallet";

const row = (o: Partial<Parameters<typeof summarizeWallet>[0][number]>) => ({
  status: "confirmed" as const, payment_status: "unpaid" as const, settlement_status: "not_due" as const, net_host_share_inr: 8000, net_commission_inr: 2000, ...o,
});

describe("host wallet summary (derived only from ledger-backed rows)", () => {
  it("an empty wallet is all zero", () => {
    expect(summarizeWallet([], [])).toEqual({ totalEarnings: 0, pendingEarnings: 0, readyForSettlement: 0, inSettlement: 0, paidOut: 0, commission: 0, completedStays: 0, confirmedBookings: 0 });
  });

  it("a confirmed, unpaid booking is earned but pending, never ready or withdrawable", () => {
    const w = summarizeWallet([row({})], []);
    expect(w).toMatchObject({ totalEarnings: 8000, pendingEarnings: 8000, readyForSettlement: 0, commission: 2000, confirmedBookings: 1 });
  });

  it("only a completed AND paid booking is ready for settlement", () => {
    expect(summarizeWallet([row({ status: "completed" })], []).readyForSettlement).toBe(0); // completed, no payment recorded
    expect(summarizeWallet([row({ status: "confirmed", payment_status: "paid" })], []).readyForSettlement).toBe(0); // paid, stay not finished
    const w = summarizeWallet([row({ status: "completed", payment_status: "paid" })], []);
    expect(w).toMatchObject({ readyForSettlement: 8000, pendingEarnings: 0, totalEarnings: 8000, completedStays: 1 });
  });

  it("a booking already in a settlement is neither pending nor ready; settlements are summed by status", () => {
    const w = summarizeWallet(
      [row({ status: "completed", payment_status: "paid", settlement_status: "processing" }), row({ status: "completed", payment_status: "paid", settlement_status: "paid" })],
      [{ status: "processing", amount_inr: 8000 }, { status: "paid", amount_inr: 8000 }, { status: "failed", amount_inr: 999 }],
    );
    expect(w).toMatchObject({ totalEarnings: 16000, pendingEarnings: 0, readyForSettlement: 0, inSettlement: 8000, paidOut: 8000 });
  });

  it("a cancelled booking earns nothing; a refunded share (reduced by reversal) is counted at its net value", () => {
    expect(summarizeWallet([row({ status: "cancelled_by_traveller", net_host_share_inr: 0, net_commission_inr: 0 })], []).totalEarnings).toBe(0);
    const w = summarizeWallet([row({ status: "completed", payment_status: "partially_refunded", net_host_share_inr: 6000, net_commission_inr: 1500 })], []);
    expect(w).toMatchObject({ totalEarnings: 6000, readyForSettlement: 6000, commission: 1500 });
    expect(summarizeWallet([row({ status: "completed", payment_status: "refunded", net_host_share_inr: 0, net_commission_inr: 0 })], []).readyForSettlement).toBe(0);
  });

  it("applies the 20/80 split on real numbers without drifting", () => {
    const w = summarizeWallet([row({ net_host_share_inr: 8000, net_commission_inr: 2000 }), row({ net_host_share_inr: 4000, net_commission_inr: 1000 })], []);
    expect(w.totalEarnings + w.commission).toBe(15000);
    expect(w.commission / (w.totalEarnings + w.commission)).toBeCloseTo(0.2, 5);
  });
});
