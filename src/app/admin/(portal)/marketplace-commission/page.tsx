import type { Metadata } from "next";

import { Card, CardTitle } from "@/components/app/ui";
import { CommissionForm } from "@/components/admin/marketplace-forms";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Marketplace commission" };

interface Row { id: number; vertical: "products" | "services"; category_id: number | null; rate_percent: number | string | null; note: string; created_at: string }
interface Cat { id: number; name: string }

export default async function AdminMarketplaceCommission() {
  const { supabase } = await requireRole(["admin"], "/admin/marketplace-commission");
  const [{ data: rows }, { data: pc }, { data: sc }] = await Promise.all([
    supabase.from("marketplace_commission_rates").select("id, vertical, category_id, rate_percent, note, created_at").order("id", { ascending: false }).limit(200),
    supabase.from("product_categories").select("id, name").order("sort_order"),
    supabase.from("service_categories").select("id, name").order("sort_order"),
  ]);
  const history = (rows ?? []) as Row[];
  const productCats = (pc ?? []) as Cat[];
  const serviceCats = (sc ?? []) as Cat[];
  const latest = (vertical: Row["vertical"], category: number | null) => history.find((r) => r.vertical === vertical && r.category_id === category);
  const current = (vertical: Row["vertical"], category: number | null) => {
    const own = category !== null ? latest(vertical, category) : undefined;
    if (own) return { rate: own.rate_percent, scope: "category" as const };
    const whole = latest(vertical, null);
    return whole ? { rate: whole.rate_percent, scope: "vertical" as const } : { rate: null, scope: "none" as const };
  };
  const show = (c: { rate: number | string | null; scope: string }) => (c.rate === null ? <span className="font-medium text-amber-800">UNCONFIGURED</span> : <span className="font-medium text-forest-950">{Number(c.rate)}%{c.scope === "vertical" ? <span className="text-xs font-normal text-ink/65"> (vertical default)</span> : null}</span>);
  const catName = (r: Row) => (r.category_id === null ? "Whole vertical" : (r.vertical === "products" ? productCats : serviceCats).find((c) => c.id === r.category_id)?.name ?? `Category ${r.category_id}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Marketplace commission</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Product and service commission is <strong>unconfigured</strong> until you approve rates here. These rates are separate from the Stay commission and never reuse it. Nothing is deducted or settled yet: there is no payment gateway, so every order and service request is unpaid.</p>
      </div>

      <Card>
        <CardTitle>Current rates</CardTitle>
        <div className="grid gap-6 md:grid-cols-2">
          {([["products", "Products (Shop)", productCats], ["services", "Services", serviceCats]] as const).map(([v, title, cats]) => (
            <div key={v}>
              <h3 className="mb-2 text-sm font-medium text-forest-950">{title}</h3>
              <ul className="divide-y divide-forest-900/8 rounded-2xl border border-forest-900/10 text-sm">
                <li className="flex items-center justify-between gap-3 px-4 py-2.5"><span>Whole vertical</span>{show(current(v, null))}</li>
                {cats.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><span>{c.name}</span>{show(current(v, c.id))}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card><CardTitle>Record a rate</CardTitle><CommissionForm productCategories={productCats} serviceCategories={serviceCats} /></Card>

      <Card>
        <CardTitle>What is still pending</CardTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/75">
          <li><strong>Payment provider:</strong> not connected. Online payment, refunds and payouts need a provider and your approval of its fees.</li>
          <li><strong>Tax and invoices:</strong> no GST treatment is applied until your accountant confirms the policy.</li>
          <li><strong>Settlements:</strong> there is nothing to settle while no payment is taken. Manual settlements will be recorded transparently once payments exist.</li>
        </ul>
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        {history.length === 0 ? <p className="text-sm text-ink/65">No rate has ever been recorded.</p> : (
          <ul className="divide-y divide-forest-900/10 text-sm">
            {history.map((r) => <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"><span><span className="font-medium text-forest-950">{r.vertical === "products" ? "Products" : "Services"} · {catName(r)}: {r.rate_percent === null ? "unconfigured" : `${Number(r.rate_percent)}%`}</span><span className="block text-xs text-ink/65">{r.note}</span></span><span className="text-xs text-ink/65">{formatDateTime(r.created_at)}</span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
