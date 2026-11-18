import type { Metadata } from "next";

import { Card, EmptyState, Stat } from "@/components/app/ui";
import { CommissionForm } from "@/components/admin/finance-forms";
import { requireRole } from "@/lib/auth";
import { formatDateTime, formatINR } from "@/lib/format";
import type { LedgerEntry } from "@/lib/db/types";

export const metadata: Metadata = { title: "Commission" };

export default async function AdminCommission() {
  const { supabase } = await requireRole(["admin"], "/admin/commission");
  const [{ data: settings }, { data: ledger }, { data: totals }] = await Promise.all([
    supabase.from("platform_settings").select("key, value").in("key", ["commission_rate_percent", "commission_base", "commission_reverse_on_cancellation", "refund_reverses_commission", "settlement_requires_payment"]),
    supabase.from("commission_ledger").select("*").order("id", { ascending: false }).limit(100),
    supabase.from("commission_ledger").select("commissionable_inr, commission_inr, host_share_inr").limit(5000),
  ]);
  const s = Object.fromEntries((settings ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const rows = (ledger ?? []) as LedgerEntry[];
  const sum = (key: "commissionable_inr" | "commission_inr" | "host_share_inr") => ((totals ?? []) as Record<string, number>[]).reduce((t, r) => t + Number(r[key]), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Commission &amp; ledger</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Commissionable base (net)" value={formatINR(sum("commissionable_inr"))} />
        <Stat label="Platform commission (net)" value={formatINR(sum("commission_inr"))} hint="After reversals" />
        <Stat label="Host share (net)" value={formatINR(sum("host_share_inr"))} />
      </div>

      <Card className="space-y-2">
        <h2 className="text-lg font-medium text-forest-950">Commission settings</h2>
        <p className="text-sm text-ink/65">The rate and base are copied onto every booking when it is requested, so changing them never rewrites past bookings. Every change is written to the audit log with the old and new values.</p>
        <CommissionForm
          rate={Number(s.commission_rate_percent ?? 20)}
          basis={String(s.commission_base ?? "accommodation")}
          reverseOnCancellation={s.commission_reverse_on_cancellation !== false}
          refundReverses={s.refund_reverses_commission !== false}
          settlementRequiresPayment={s.settlement_requires_payment !== false}
        />
      </Card>

      <section aria-labelledby="ledger-h" className="space-y-3">
        <h2 id="ledger-h" className="text-lg font-medium text-forest-950">Ledger (append-only)</h2>
        {rows.length === 0 ? <EmptyState title="No ledger entries yet" description="An entry is added when a host confirms a booking." /> : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-forest-900/10">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink/55"><tr><th className="p-3">When</th><th className="p-3">Entry</th><th className="p-3 text-right">Base</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Commission</th><th className="p-3 text-right">Host share</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-forest-900/8">
                    <td className="p-3 text-ink/60">{formatDateTime(r.created_at)}</td>
                    <td className="p-3 capitalize">{r.kind}{r.note ? <span className="block text-xs text-ink/50">{r.note}</span> : null}</td>
                    <td className="p-3 text-right">{formatINR(r.commissionable_inr)}</td>
                    <td className="p-3 text-right">{Number(r.commission_rate_percent)}%</td>
                    <td className="p-3 text-right font-medium">{formatINR(r.commission_inr)}</td>
                    <td className="p-3 text-right">{formatINR(r.host_share_inr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
