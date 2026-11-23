import type { Metadata } from "next";

import { Card, DefinitionList, EmptyState } from "@/components/app/ui";
import { TriageForm } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Gardening enquiries" };

const STATUSES = ["new", "in_progress", "resolved", "spam"];

interface Row {
  id: string; name: string; email: string | null; phone: string | null; location: string; pin_code: string | null;
  property_type: string; garden_size: string | null; services: string[]; requirements: string | null; budget_range: string | null;
  preferred_date: string | null; preferred_time_window: string | null; photo_paths: string[]; status: string; admin_notes: string | null; created_at: string;
}

/** Gardening enquiries are a separate module: they never create or touch a stay booking. */
export default async function AdminGardening({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = await requireRole(["admin"], "/admin/gardening");
  const status = STATUSES.includes(sp.status ?? "") ? (sp.status as string) : "all";
  let q = supabase.from("gardening_enquiries").select("*").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const rows = (data ?? []) as Row[];

  // Private bucket: signed links are minted server-side, only after the admin check above.
  const signed: Record<string, string[]> = {};
  if (isServiceRoleConfigured()) {
    const admin = createAdminSupabase();
    for (const r of rows) {
      if (!r.photo_paths?.length) continue;
      const { data: urls } = await admin.storage.from("enquiry-photos").createSignedUrls(r.photo_paths, 3600);
      signed[r.id] = (urls ?? []).map((u) => u.signedUrl).filter(Boolean) as string[];
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Gardening enquiries</h1>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {["all", ...STATUSES].map((f) => (
          <a key={f} href={`/admin/gardening?status=${f}`} aria-current={f === status ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm capitalize ${f === status ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>{f.replace("_", " ")}</a>
        ))}
      </nav>
      {rows.length === 0 ? <EmptyState title="No gardening enquiries" description="Enquiries sent from the Gardening Services page appear here." /> : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-medium text-forest-950">{r.name}</p><p className="text-sm text-ink/65">{[r.email, r.phone].filter(Boolean).join(" · ")}</p></div>
                  <time className="text-xs text-ink/65" dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
                </div>
                <DefinitionList items={[
                  { label: "Location", value: r.location }, { label: "PIN code", value: r.pin_code },
                  { label: "Property type", value: r.property_type }, { label: "Garden size", value: r.garden_size },
                  { label: "Services", value: r.services.join(", ") }, { label: "Budget", value: r.budget_range },
                  { label: "Preferred date", value: r.preferred_date ? formatDate(r.preferred_date) : null }, { label: "Preferred time", value: r.preferred_time_window },
                ]} />
                {r.requirements ? <p className="whitespace-pre-line text-sm text-ink/80">{r.requirements}</p> : null}
                {r.photo_paths?.length ? (
                  <p className="text-sm">{signed[r.id]?.length ? signed[r.id].map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer noopener" className="mr-3 text-forest-700 underline">Photo {i + 1}</a>) : <span className="text-ink/65">{r.photo_paths.length} photo(s) attached — set SUPABASE_SERVICE_ROLE_KEY to view them here.</span>}</p>
                ) : null}
                <TriageForm table="gardening_enquiries" id={r.id} status={r.status} notes={r.admin_notes} statuses={STATUSES} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
