import Link from "next/link";
import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/app/ui";
import { TriageForm } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReports() {
  const { supabase } = await requireRole(["admin"], "/admin/reports");
  const { data } = await supabase.from("reports").select("id, reason, details, status, created_at, property_id, properties(name, slug)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as { id: string; reason: string; details: string | null; status: string; created_at: string; property_id: string; properties: { name: string; slug: string } | null }[];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Listing reports</h1>
      {rows.length === 0 ? <EmptyState title="No reports" description="Reports filed by visitors against a listing appear here." /> : (
        <ul className="space-y-4">{rows.map((r) => (
          <li key={r.id}><Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium text-forest-950">{r.reason}</p>
                <p className="text-sm text-ink/60">Listing: <Link href={`/admin/properties/${r.property_id}`} className="text-forest-700 underline">{r.properties?.name ?? "unavailable"}</Link></p></div>
              <time className="text-xs text-ink/45" dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
            </div>
            {r.details ? <p className="whitespace-pre-line text-sm text-ink/80">{r.details}</p> : null}
            <TriageForm table="reports" id={r.id} status={r.status} statuses={["open", "reviewing", "closed"]} />
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
