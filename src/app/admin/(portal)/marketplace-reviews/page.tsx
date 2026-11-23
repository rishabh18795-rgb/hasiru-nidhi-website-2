import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { ReviewModerationForm } from "@/components/admin/service-forms";
import { Stars } from "@/components/reviews/review-list";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Marketplace reviews" };

const FILTERS = [["pending", "Waiting"], ["approved", "Published"], ["rejected", "Not published"], ["all", "All"]] as const;
interface Row { id: string; kind: "product" | "service"; rating: number; title: string | null; body: string; status: string; moderation_note: string | null; created_at: string; products: { name: string; slug: string } | null; services: { name: string; slug: string } | null; vendors: { business_name: string } | null; profiles: { full_name: string } | null }

export default async function AdminMarketplaceReviews({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole(["admin"], "/admin/marketplace-reviews");
  const sp = await searchParams;
  const filter = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "pending";
  let q = supabase.from("marketplace_reviews").select("id, kind, rating, title, body, status, moderation_note, created_at, products(name, slug), services(name, slug), vendors(business_name), profiles!author_id(full_name)").order("created_at", { ascending: true }).limit(200);
  if (filter !== "all") q = q.eq("status", filter);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Marketplace reviews</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Only customers who received a product or completed a service can write a review, once each. Nothing is public until you approve it, and you can hide a published review again with a reason. The text can never be edited.</p>
      </div>
      <nav aria-label="Filter reviews" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => <Link key={k} href={`/admin/marketplace-reviews?status=${k}`} aria-current={filter === k ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", filter === k ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50")}>{label}</Link>)}
      </nav>
      {rows.length === 0 ? <EmptyState title="No reviews here" description={filter === "pending" ? "No reviews are waiting for you." : "Nothing matches this filter."} /> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-950">{r.kind === "product" ? r.products?.name : r.services?.name}</p>
                    <p className="text-xs text-ink/65">{r.kind === "product" ? "Verified purchase" : "Completed service"} · {r.vendors?.business_name} · by {r.profiles?.full_name?.split(" ")[0] ?? "a customer"} · {formatDateTime(r.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3"><Stars value={r.rating} /><StatusBadge status={r.status === "rejected" ? "rejected" : r.status} /></div>
                </div>
                {r.title ? <p className="mt-3 font-medium text-forest-950">{r.title}</p> : null}
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink/80">{r.body}</p>
                {r.moderation_note ? <p className="mt-2 text-xs text-ink/65">Note: {r.moderation_note}</p> : null}
                <div className="mt-4 border-t border-forest-900/10 pt-4"><ReviewModerationForm reviewId={r.id} status={r.status} /></div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
