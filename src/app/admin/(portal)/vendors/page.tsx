import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vendors" };

const FILTERS = [["queue", "Needs review"], ["all", "All"], ["approved", "Approved"], ["rejected", "Rejected"], ["suspended", "Suspended"], ["draft", "Drafts"]] as const;

interface Row {
  id: string; business_name: string; status: string; submitted_at: string | null; city: string | null; owner_id: string; is_legacy_host: boolean;
  vendor_capabilities: { capability: string; status: string }[];
}

export default async function AdminVendors({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole(["admin"], "/admin/vendors");
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "queue";
  let q = supabase.from("vendors").select("id, business_name, status, submitted_at, city, owner_id, is_legacy_host, vendor_capabilities(capability, status)").order("submitted_at", { ascending: false, nullsFirst: false }).limit(200);
  if (filter === "queue") q = q.in("status", ["submitted", "under_review"]);
  else if (filter !== "all") q = q.eq("status", filter);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.map((r) => r.owner_id))];
  const { data: owners } = ids.length ? await supabase.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const owner = new Map((owners ?? []).map((o) => [o.id as string, o as { email: string | null; full_name: string }]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Vendors</h1>
        <p className="mt-1 text-sm text-ink/65">Applications and verification. Approving the business does not approve any capability; each is approved on its own, and listings are approved separately again.</p>
      </div>
      <nav aria-label="Filter vendors" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin/vendors?status=${k}`} aria-current={filter === k ? "page" : undefined}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>
        ))}
      </nav>
      {rows.length === 0 ? <EmptyState title="No vendors here" description={filter === "queue" ? "No applications are waiting for review." : "Nothing matches this filter."} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/65"><tr><th className="px-4 py-3">Business</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Capabilities</th><th className="px-4 py-3">Submitted</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><Link href={`/admin/vendors/${r.id}`} className="font-medium text-forest-800 underline">{r.business_name}</Link>{r.is_legacy_host ? <span className="ml-2 text-xs text-ink/65">existing host</span> : null}<div className="text-xs text-ink/65">{r.city}</div></td>
                  <td className="px-4 py-3 text-ink/70">{owner.get(r.owner_id)?.full_name || "—"}<div className="text-xs text-ink/65">{owner.get(r.owner_id)?.email}</div></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{r.vendor_capabilities.map((c) => <span key={c.capability} className="text-xs text-ink/70">{c.capability}: <StatusBadge status={c.status} /></span>)}</div></td>
                  <td className="px-4 py-3 text-ink/65">{formatDate(r.submitted_at) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
