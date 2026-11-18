import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/app/ui";
import { CreateSettlementForm, SettlementStatusForm } from "@/components/admin/finance-forms";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { BookingFinancial, HostSettlement } from "@/lib/db/types";

export const metadata: Metadata = { title: "Settlements" };

interface Settleable { booking_id: string; property_name: string; check_out: string; net_host_share_inr: number }

export default async function AdminSettlements() {
  const { supabase } = await requireRole(["admin"], "/admin/settlements");
  const [{ data: candidates }, { data: settlements }] = await Promise.all([
    supabase.from("booking_financials").select("host_id").eq("status", "completed").eq("settlement_status", "not_due").not("host_id", "is", null).limit(1000),
    supabase.from("host_settlements").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const hostIds = [...new Set(((candidates ?? []) as Pick<BookingFinancial, "host_id">[]).map((c) => c.host_id as string))].slice(0, 25);
  const rows = (settlements ?? []) as HostSettlement[];
  const allIds = [...new Set([...hostIds, ...rows.map((r) => r.host_id)])];
  const { data: profiles } = allIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", allIds) : { data: [] };
  const name = (id: string) => {
    const p = ((profiles ?? []) as { id: string; full_name: string; email: string | null }[]).find((x) => x.id === id);
    return p ? `${p.full_name || "(no name)"}${p.email ? ` · ${p.email}` : ""}` : id.slice(0, 8);
  };
  // The database decides what is settleable (completed, unsettled, positive net share, payment rule); we only display it.
  const due = (await Promise.all(hostIds.map(async (hostId) => {
    const { data } = await supabase.rpc("admin_settleable_bookings", { p_host: hostId });
    return { hostId, items: ((data ?? []) as Settleable[]) };
  }))).filter((d) => d.items.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Host settlements</h1>
        <p role="note" className="mt-3 max-w-3xl rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">
          A settlement groups a host&apos;s completed, paid bookings and the host share owed. Each booking can be settled only once. Money is transferred outside this website (for example by bank transfer); enter the transfer reference when you mark a settlement as paid.
        </p>
      </div>

      <section aria-labelledby="due-h" className="space-y-3">
        <h2 id="due-h" className="text-lg font-medium text-forest-950">Ready to settle</h2>
        {due.length === 0 ? <EmptyState title="Nothing is ready to settle" description="A booking becomes settleable once the stay is completed and its payment is recorded." /> : (
          <ul className="space-y-3">
            {due.map(({ hostId, items }) => (
              <li key={hostId}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-forest-950">{name(hostId)}</p>
                    <p className="font-display text-xl text-forest-950">{formatINR(items.reduce((t, i) => t + Number(i.net_host_share_inr), 0))}</p>
                  </div>
                  <ul className="text-sm text-ink/65">
                    {items.map((i) => <li key={i.booking_id}>{i.property_name} · checked out {formatDate(i.check_out)} · {formatINR(i.net_host_share_inr)}</li>)}
                  </ul>
                  <CreateSettlementForm hostId={hostId} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="all-h" className="space-y-3">
        <h2 id="all-h" className="text-lg font-medium text-forest-950">Settlements</h2>
        {rows.length === 0 ? <EmptyState title="No settlements yet" /> : (
          <ul className="space-y-3">
            {rows.map((s) => (
              <li key={s.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-forest-950">{name(s.host_id)}</p>
                    <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs capitalize text-forest-800">{s.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-ink/70">{formatINR(s.amount_inr)} · created {formatDateTime(s.created_at)}{s.paid_at ? ` · paid ${formatDateTime(s.paid_at)}` : ""}{s.note ? ` · ${s.note}` : ""}</p>
                  <SettlementStatusForm id={s.id} status={s.status} reference={s.reference} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
