import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Pencil, Plus } from "lucide-react";

import { Card, EmptyState, SampleBadge, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Property } from "@/lib/db/types";
import { wizardPath } from "@/lib/wizard/steps";

export const metadata: Metadata = { title: "My properties" };

const TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected / changes requested" },
  { value: "suspended", label: "Suspended" },
] as const;

export default async function HostProperties({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireRole(["host"], "/host/properties");
  const { data } = await supabase.from("properties").select("*").eq("host_id", user.id).order("updated_at", { ascending: false });
  const all = (data ?? []) as Property[];
  const tab = TABS.find((t) => t.value === sp.status)?.value ?? "all";
  const list = tab === "all" ? all : all.filter((p) => p.status === tab);
  const count = (v: string) => (v === "all" ? all.length : all.filter((p) => p.status === v).length);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">My properties</h1>
        <Link href="/host/properties/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700"><Plus className="h-4 w-4" aria-hidden="true" /> Add a property</Link>
      </div>
      {sp.deleted ? <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900">Draft deleted.</p> : null}
      {all.length > 0 ? (
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link key={t.value} href={t.value === "all" ? "/host/properties" : `/host/properties?status=${t.value}`} aria-current={t.value === tab ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm ${t.value === tab ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>
              {t.label} <span className="opacity-70">({count(t.value)})</span>
            </Link>
          ))}
        </nav>
      ) : null}
      {all.length === 0 ? (
        <EmptyState title="You haven't added a property yet" description="Start the listing wizard: it saves a draft after every step." action={{ href: "/host/properties/new", label: "Add your first property" }} />
      ) : list.length === 0 ? (
        <EmptyState title="Nothing here" description="No properties have this status." />
      ) : (
        <ul className="space-y-4">
          {list.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl text-forest-950">{p.name}</p>
                    {p.is_sample ? <SampleBadge /> : null}
                    <StatusBadge status={p.status} />
                    {p.status === "rejected" && p.review_kind === "changes_requested" ? <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-earth-700">Changes requested</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{[p.city, p.state].filter(Boolean).join(", ") || "Location not set"} · updated {formatDate(p.updated_at)}</p>
                  {p.status === "rejected" && p.rejection_reason ? <p className="mt-2 text-sm text-red-700">{p.review_kind === "changes_requested" ? "Changes requested" : "Rejected"}: {p.rejection_reason}</p> : null}
                  {p.status === "suspended" && p.rejection_reason ? <p className="mt-2 text-sm text-red-700">Suspended: {p.rejection_reason}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={p.status === "draft" || p.status === "rejected" ? wizardPath(p.id, "type") : `/host/properties/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-900/20 px-4 text-sm text-forest-900 hover:bg-forest-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {p.status === "draft" ? "Continue" : p.status === "rejected" ? "Edit & resubmit" : "Manage"}</Link>
                  <Link href={`/host/properties/${p.id}/availability`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-900/20 px-4 text-sm text-forest-900 hover:bg-forest-50"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Calendar</Link>
                  {p.status === "approved" ? <Link href={`/stays/${p.slug}`} className="inline-flex h-9 items-center rounded-full bg-forest-50 px-4 text-sm text-forest-800 hover:bg-forest-100">View live</Link> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
