import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { summarizeWallet } from "@/lib/wallet";
import type { BookingFinancial, HostSettlement } from "@/lib/db/types";

export const metadata: Metadata = { title: "Wallet & earnings" };

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Payment not recorded", initiated: "Payment started", paid: "Paid", failed: "Payment failed", partially_refunded: "Partly refunded", refunded: "Refunded",
};
const SETTLEMENT_LABEL: Record<string, string> = {
  not_due: "Not in a settlement", pending: "Settlement pending", processing: "Processing", paid: "Paid to you", on_hold: "On hold", failed: "Failed",
};

interface LedgerRow {
  id: number; booking_id: string; kind: "accrual" | "reversal"; commissionable_inr: number; commission_rate_percent: number;
  commission_inr: number; host_share_inr: number; note: string | null; created_at: string;
  bookings: { property_name: string; check_in: string; check_out: string } | null;
}

const n = (v: unknown) => Number(v ?? 0);

/**
 * Host wallet. Every figure is derived from real records the host can read under Row Level Security: booking_financials (one row per
 * booking), the append-only commission_ledger and host_settlements. Nothing here is a stored balance that could drift, and no amount is
 * called "available" unless the booking is completed and its payment has been recorded.
 */
export default async function HostWallet() {
  const { supabase } = await requireRole(["host"], "/host/earnings");
  const [{ data: money }, { data: ledger }, { data: settlements }] = await Promise.all([
    supabase.from("booking_financials").select("*").in("status", ["confirmed", "completed", "cancelled_by_traveller", "cancelled_by_host"]).order("check_in", { ascending: false }).limit(300),
    supabase.from("commission_ledger").select("*, bookings(property_name, check_in, check_out)").order("id", { ascending: false }).limit(300),
    supabase.from("host_settlements").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const all = (money ?? []) as BookingFinancial[];
  const entries = (ledger ?? []) as unknown as LedgerRow[];
  const sets = (settlements ?? []) as HostSettlement[];

  const earning = all.filter((b) => b.status === "confirmed" || b.status === "completed");
  const w = summarizeWallet(all, sets);
  const adjustments = entries.filter((e) => e.kind === "reversal").reduce((t, e) => t + n(e.host_share_inr), 0); // negative or zero
  const totalEarnings = w.totalEarnings, pendingEarnings = w.pendingEarnings, readyAmount = w.readyForSettlement;
  const inSettlement = w.inSettlement, paidOut = w.paidOut, commission = w.commission;

  const cards: { label: string; value: string; hint: string }[] = [
    { label: "Total earnings", value: formatINR(totalEarnings), hint: "Your 80% share of confirmed and completed bookings, after reversals" },
    { label: "Pending earnings", value: formatINR(pendingEarnings), hint: "Confirmed stays not yet completed, or completed with no payment recorded" },
    { label: "Ready for settlement", value: formatINR(readyAmount), hint: "Completed and paid. Not yet in a settlement; not withdrawable by you" },
    { label: "In settlement", value: formatINR(inSettlement), hint: "Prepared by the Hasiru Nidhi team: pending, processing or on hold" },
    { label: "Paid to you", value: formatINR(paidOut), hint: "Settlements the team has marked as paid, with a bank reference" },
    { label: "Platform commission", value: formatINR(commission), hint: "Deducted from the commissionable base of each booking" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Wallet &amp; earnings</h1>
        <p role="note" className="mt-3 max-w-3xl rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">
          <strong>Online payments and automatic payouts are not available yet.</strong> Guests and hosts settle payment as described in the booking confirmation. The Hasiru Nidhi team records payments that were actually received and prepares your settlements; nothing here can be withdrawn by you from this page. Tax, cleaning-fee and refund treatment follow the company&apos;s confirmed policy.
        </p>
      </div>

      <section aria-label="Wallet summary" className="rounded-3xl bg-gradient-to-br from-forest-950 via-forest-900 to-forest-700 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="glass-dark rounded-2xl p-5">
              <p className="text-xs uppercase tracking-wide text-cream/70">{c.label}</p>
              <p className="mt-1.5 font-display text-3xl">{c.value}</p>
              <p className="mt-1 text-xs leading-snug text-cream/70">{c.hint}</p>
            </div>
          ))}
        </div>
        {adjustments < 0 ? <p className="mt-4 text-sm text-cream/85">Refund and cancellation adjustments included above: <strong>{formatINR(adjustments)}</strong> of your share.</p> : null}
      </section>

      <details className="group rounded-2xl border border-forest-900/10 bg-white p-5 text-sm leading-relaxed text-ink/75">
        <summary className="cursor-pointer list-none font-medium text-forest-950 marker:content-none">How your wallet is calculated <span className="text-ink/65 group-open:hidden">(show)</span></summary>
        <div className="mt-3 space-y-3">
          <p><strong>Commissionable base.</strong> Each booking stores the platform commission rate and amounts at the moment it was requested. Later changes to the rate never alter an existing booking. The default is 20%, so you keep 80% of the commissionable base. For example, on a base of ₹10,000 the commission is ₹2,000 and your share is ₹8,000.</p>
          <p><strong>What is not assumed.</strong> Taxes are not part of the commissionable base. Whether cleaning fees, discounts and gateway charges are included follows the company&apos;s confirmed policy, which is shown on each booking&apos;s saved figures.</p>
          <p><strong>Pending.</strong> A confirmed stay that is not yet completed, or a completed stay whose payment has not been recorded. <strong>Ready for settlement.</strong> A completed stay with a recorded payment that is not yet in a settlement. <strong>In settlement / Paid to you.</strong> Set by the Hasiru Nidhi team, with a bank reference when paid.</p>
          <p><strong>Adjustments.</strong> If a confirmed booking is cancelled or a refund is recorded, a negative ledger line reverses the commission and your share in proportion. Ledger lines are never edited or deleted.</p>
        </div>
      </details>

      <section aria-labelledby="bk-h" className="space-y-3">
        <h2 id="bk-h" className="text-lg font-medium text-forest-950">Booking-wise earnings</h2>
        {earning.length === 0 ? <EmptyState title="No earnings yet" description="Earnings appear here once you confirm a booking request." /> : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-forest-900/10">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink/65">
                <tr><th className="p-3">Stay</th><th className="p-3 text-right">Guest total</th><th className="p-3 text-right">Commission</th><th className="p-3 text-right">Your share</th><th className="p-3">Payment</th><th className="p-3">Settlement</th></tr>
              </thead>
              <tbody>
                {earning.map((b) => (
                  <tr key={b.booking_id} className="border-t border-forest-900/8 align-top">
                    <td className="p-3"><span className="font-medium text-forest-950">{b.property_name}</span><span className="block text-xs text-ink/65">{b.guest_name} · {formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.status}</span></td>
                    <td className="p-3 text-right">{b.gross_inr !== null ? formatINR(b.gross_inr) : "—"}</td>
                    <td className="p-3 text-right">{formatINR(b.net_commission_inr)}{b.commission_rate_percent !== null ? <span className="block text-xs text-ink/65">{Number(b.commission_rate_percent)}%</span> : null}</td>
                    <td className="p-3 text-right font-medium">{formatINR(b.net_host_share_inr)}</td>
                    <td className="p-3">{PAYMENT_LABEL[b.payment_status] ?? b.payment_status}</td>
                    <td className="p-3">{SETTLEMENT_LABEL[b.settlement_status] ?? b.settlement_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="led-h" className="space-y-3">
        <h2 id="led-h" className="text-lg font-medium text-forest-950">Transaction history</h2>
        <p className="text-sm text-ink/65">Each line is an immutable ledger entry tied to a booking. Reversals appear as negative lines when a confirmed booking is cancelled or a refund is recorded.</p>
        {entries.length === 0 ? <EmptyState title="No transactions yet" description="A ledger entry is created when you confirm a booking." /> : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-forest-900/10">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink/65">
                <tr><th className="p-3">Date</th><th className="p-3">Entry</th><th className="p-3">Booking</th><th className="p-3 text-right">Base</th><th className="p-3 text-right">Commission</th><th className="p-3 text-right">Your share</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-forest-900/8 align-top">
                    <td className="p-3 text-ink/65">{formatDateTime(e.created_at)}</td>
                    <td className="p-3 capitalize">{e.kind}{e.note ? <span className="block text-xs normal-case text-ink/65">{e.note}</span> : null}</td>
                    <td className="p-3">{e.bookings ? <>{e.bookings.property_name}<span className="block text-xs text-ink/65">{formatDate(e.bookings.check_in)} → {formatDate(e.bookings.check_out)}</span></> : "—"}</td>
                    <td className="p-3 text-right">{formatINR(e.commissionable_inr)}</td>
                    <td className="p-3 text-right">{formatINR(e.commission_inr)}<span className="block text-xs text-ink/65">{Number(e.commission_rate_percent)}%</span></td>
                    <td className="p-3 text-right font-medium">{formatINR(e.host_share_inr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="st-h" className="space-y-3">
        <h2 id="st-h" className="text-lg font-medium text-forest-950">Settlement history</h2>
        {sets.length === 0 ? <EmptyState title="No settlements yet" description="A settlement is prepared by the Hasiru Nidhi team after a stay is completed and its payment is recorded. Timing and eligibility follow the company's confirmed policy." /> : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <span>{formatINR(s.amount_inr)} · prepared {formatDateTime(s.created_at)}{s.paid_at ? ` · paid ${formatDateTime(s.paid_at)}` : ""}{s.reference ? ` · bank ref ${s.reference}` : ""}</span>
                  <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs text-forest-800">{SETTLEMENT_LABEL[s.status] ?? s.status}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
