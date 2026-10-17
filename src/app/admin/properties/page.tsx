import Link from "next/link";
import type { Metadata } from "next";

import { Card, EmptyState, SampleBadge, StatusBadge } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Property } from "@/lib/db/types";

export const metadata: Metadata = { title: "Listings" };

const TABS = [
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Live" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "draft", label: "Drafts" },
  { value: "all", label: "All" },
] as const;

export default async function AdminProperties({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = TABS.find((t) => t.value === sp.status)?.value ?? "pending_review";
  const { supabase } = await requireRole(["admin"], "/admin/properties");
  let q = supabase.from("properties").select("id, name, status, city, state, is_sample, is_featured, submitted_at, updated_at, host_id").order("updated_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  const list = (data ?? []) as Pick<Property, "id" | "name" | "status" | "city" | "state" | "is_sample" | "is_featured" | "submitted_at" | "updated_at">[];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Listings</h1>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.value} href={`/admin/properties?status=${t.value}`} aria-current={t.value === status ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm ${t.value === status ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"}`}>{t.label}</Link>
        ))}
      </nav>
      {list.length === 0 ? <EmptyState title="Nothing here" description="No listings match this filter." /> : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/properties/${p.id}`} className="font-medium text-forest-950 hover:underline">{p.name}</Link>
                    <StatusBadge status={p.status} />
                    {p.is_sample ? <SampleBadge /> : null}
                    {p.is_featured ? <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-earth-700">Featured</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink/55">{[p.city, p.state].filter(Boolean).join(", ")} · {p.submitted_at ? `submitted ${formatDate(p.submitted_at)}` : `updated ${formatDate(p.updated_at)}`}</p>
                </div>
                <Link href={`/admin/properties/${p.id}`} className="text-sm text-forest-700 underline">Review</Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
