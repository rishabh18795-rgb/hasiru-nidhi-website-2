import type { Metadata } from "next";

import { Card, EmptyState, Stat } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { BookingFinancial, HostSettlement } from "@/lib/db/types";

export const metadata: Metadata = { title: "Earnings" };

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Not paid yet", initiated: "Payment started", paid: "Paid", failed: "Payment failed", partially_refunded: "Partly refunded", refunded: "Refunded",
};
const SETTLEMENT_LABEL: Record<string, string> = {
  not_due: "Not due", pending: "Pending", processing: "Processing", paid: "Paid to you", on_hold: "On hold", failed: "Failed",
};

export default async function HostEarnings() {
  const { supabase } = await requireRole(["host"], "/host/earnings");
  // Row Level Security limits both queries to this host's own bookings and settlements.
  const [{ data: money }, { data: settlements }] = await Promise.all([
    supabase.from("booking_financials").select("*").in("status", ["confirmed", "completed", "cancelled_by_traveller", "cancelled_by_host"]).order("check_in", { ascending: false }).limit(200),
    supabase.from("host_settlements").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const rows = ((money ?? []) as BookingFinancial[]).filter((b) => Number(b.net_host_share_inr) > 0 || b.status === "confirmed" || b.status === "completed");
  const sets = (settlements ?? []) as HostSettlement[];
  const sum = (f: (b: BookingFinancial) => number) => rows.reduce((t, b) => t + f(b), 0);
  const settled = sets.filter((s) => s.status === "paid").reduce((t, s) => t + Number(s.amount_inr), 0);
  const inProgress = sets.filter((s) => ["pending", "processing", "on_hold"].includes(s.status)).reduce((t, s) => t + Number(s.amount_inr), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Earnings</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Each booking shows the guest total, the platform commission and your share. The commission rate is fixed on each booking when it is requested. Settlements are prepared by the Hasiru Nidhi team for completed, paid stays and transferred to you outside this website.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Your share on confirmed and completed stays" value={formatINR(sum((b) => (b.status === "confirmed" || b.status === "completed" ? Number(b.net_host_share_inr) : 0)))} hint="After platform commission" />
        <Stat label="Settlement in progress" value={formatINR(inProgress)} />
        <Stat label="Paid out to you" value={formatINR(settled)} />
      </div>

      <section aria-labelledby="bk-h" className="space-y-3">
        <h2 id="bk-h" className="text-lg font-medium text-forest-950">Bookings</h2>
        {rows.length === 0 ? <EmptyState title="No earnings yet" description="Earnings appear here once you confirm a booking." /> : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-forest-900/10">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink/55">
                <tr><th className="p-3">Stay</th><th className="p-3 text-right">Guest total</th><th className="p-3 text-right">Commission</th><th className="p-3 text-right">Your share</th><th className="p-3">Payment</th><th className="p-3">Settlement</th></tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.booking_id} className="border-t border-forest-900/8 align-top">
                    <td className="p-3"><span className="font-medium text-forest-950">{b.property_name}</span><span className="block text-xs text-ink/55">{b.guest_name} · {formatDate(b.check_in)} → {formatDate(b.check_out)} · {b.status.replace(/_/g, " ")}</span></td>
                    <td className="p-3 text-right">{b.gross_inr !== null ? formatINR(b.gross_inr) : "—"}</td>
                    <td className="p-3 text-right">{formatINR(b.net_commission_inr)}{b.commission_rate_percent !== null ? <span className="block text-xs text-ink/50">{Number(b.commission_rate_percent)}%</span> : null}</td>
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

      <section aria-labelledby="st-h" className="space-y-3">
        <h2 id="st-h" className="text-lg font-medium text-forest-950">Settlements</h2>
        {sets.length === 0 ? <EmptyState title="No settlements yet" description="A settlement is prepared after a stay is completed and its payment is recorded." /> : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <span>{formatINR(s.amount_inr)} · {formatDateTime(s.created_at)}{s.reference ? ` · ref ${s.reference}` : ""}</span>
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
