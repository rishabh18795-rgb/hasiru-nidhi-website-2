import Link from "next/link";
import type { Metadata } from "next";

import { Card, DefinitionList, EmptyState } from "@/components/app/ui";
import { TriageForm } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Enquiries" };

const TABS = [
  { value: "contact", label: "Contact & requests" },
  { value: "gardening", label: "Gardening quotes" },
  { value: "partners", label: "Partner applications" },
] as const;
const ENQ_STATUS = ["new", "in_progress", "resolved", "spam"];
const APP_STATUS = ["new", "contacted", "invited", "closed"];

export default async function AdminEnquiries({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.value === sp.tab)?.value ?? "contact";
  const { supabase } = await requireRole(["admin"], "/admin/enquiries");

  const nav = (
    <nav aria-label="Enquiry type" className="flex flex-wrap gap-2">
      {TABS.map((t) => <Link key={t.value} href={`/admin/enquiries?tab=${t.value}`} aria-current={t.value === tab ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm ${t.value === tab ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>{t.label}</Link>)}
    </nav>
  );

  if (tab === "contact") {
    const { data } = await supabase.from("contact_enquiries").select("*, properties(name)").order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as unknown as { id: string; kind: string; name: string; email: string | null; phone: string | null; subject: string | null; message: string; payload: Record<string, unknown>; status: string; admin_notes: string | null; created_at: string; properties: { name: string } | null }[];
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Enquiries</h1>{nav}
        {rows.length === 0 ? <EmptyState title="No enquiries yet" /> : (
          <ul className="space-y-4">{rows.map((r) => (
            <li key={r.id}><Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium text-forest-950">{r.name} <span className="ml-2 rounded-full bg-forest-50 px-2 py-0.5 text-xs capitalize text-forest-800">{r.kind.replace("_", " ")}</span></p>
                  <p className="text-sm text-ink/60">{[r.email, r.phone].filter(Boolean).join(" · ")}</p></div>
                <time className="text-xs text-ink/45" dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
              </div>
              {r.subject ? <p className="text-sm font-medium text-ink/80">{r.subject}</p> : null}
              {r.properties ? <p className="text-xs text-ink/55">About listing: {r.properties.name}</p> : null}
              <p className="whitespace-pre-line text-sm text-ink/80">{r.message}</p>
              {Object.keys(r.payload ?? {}).length ? <DefinitionList items={Object.entries(r.payload).filter(([, v]) => v).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: String(v) }))} /> : null}
              <TriageForm table="contact_enquiries" id={r.id} status={r.status} notes={r.admin_notes} statuses={ENQ_STATUS} />
            </Card></li>
          ))}</ul>
        )}
      </div>
    );
  }

  if (tab === "gardening") {
    const { data } = await supabase.from("gardening_enquiries").select("*").order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as { id: string; name: string; email: string | null; phone: string | null; location: string; property_type: string; garden_size: string | null; services: string[]; requirements: string | null; budget_range: string | null; photo_paths: string[]; status: string; admin_notes: string | null; created_at: string }[];
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
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Enquiries</h1>{nav}
        {rows.length === 0 ? <EmptyState title="No gardening quote requests yet" /> : (
          <ul className="space-y-4">{rows.map((r) => (
            <li key={r.id}><Card className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-medium text-forest-950">{r.name}</p><p className="text-sm text-ink/60">{[r.email, r.phone].filter(Boolean).join(" · ")}</p></div>
                <time className="text-xs text-ink/45" dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
              </div>
              <DefinitionList items={[
                { label: "Location", value: r.location }, { label: "Property type", value: r.property_type },
                { label: "Garden size", value: r.garden_size }, { label: "Budget", value: r.budget_range },
                { label: "Services", value: r.services.join(", ") },
              ]} />
              {r.requirements ? <p className="whitespace-pre-line text-sm text-ink/80">{r.requirements}</p> : null}
              {r.photo_paths?.length ? (
                <p className="text-sm">{signed[r.id]?.length ? signed[r.id].map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer noopener" className="mr-3 text-forest-700 underline">Photo {i + 1}</a>) : <span className="text-ink/55">{r.photo_paths.length} photo(s) attached — set SUPABASE_SERVICE_ROLE_KEY to view them here.</span>}</p>
              ) : null}
              <TriageForm table="gardening_enquiries" id={r.id} status={r.status} notes={r.admin_notes} statuses={ENQ_STATUS} />
            </Card></li>
          ))}</ul>
        )}
      </div>
    );
  }

  const { data } = await supabase.from("partner_applications").select("*").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: string; owner_name: string; email: string; phone: string; property_name: string; city: string; state: string; category: string | null; rooms_count: number | null; max_guests: number | null; description: string | null; current_platforms: string | null; partnership_model: string | null; status: string; admin_notes: string | null; created_at: string }[];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Enquiries</h1>{nav}
      {rows.length === 0 ? <EmptyState title="No partner applications yet" /> : (
        <ul className="space-y-4">{rows.map((r) => (
          <li key={r.id}><Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium text-forest-950">{r.property_name} <span className="text-sm font-normal text-ink/55">· {r.city}, {r.state}</span></p><p className="text-sm text-ink/60">{r.owner_name} · {r.phone} · {r.email}</p></div>
              <time className="text-xs text-ink/45" dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
            </div>
            <DefinitionList items={[{ label: "Category", value: r.category }, { label: "Rooms", value: r.rooms_count }, { label: "Capacity", value: r.max_guests }, { label: "Listed elsewhere", value: r.current_platforms }, { label: "Partnership preference", value: r.partnership_model }]} />
            {r.description ? <p className="whitespace-pre-line text-sm text-ink/80">{r.description}</p> : null}
            <TriageForm table="partner_applications" id={r.id} status={r.status} notes={r.admin_notes} statuses={APP_STATUS} />
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
