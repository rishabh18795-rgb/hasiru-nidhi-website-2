import Link from "next/link";
import type { Metadata } from "next";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { moderateReview } from "@/app/admin/actions";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Reviews" };

interface Row {
  id: string;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
  property_id: string;
  properties: { name: string } | null;
  profiles: { full_name: string } | null;
}

export default async function AdminReviews() {
  const { supabase } = await requireRole(["admin"], "/admin/reviews");
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, is_hidden, created_at, property_id, properties(name), profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Reviews</h1>
        <p className="mt-1 text-sm text-ink/60">
          Only guests of a finished, confirmed stay can leave a review. You can hide a review that breaks the rules or restore it later; the text and rating can never be edited. Every decision is recorded in the audit log.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No reviews yet" description="Reviews from completed stays will appear here." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-forest-950">
                      {"★".repeat(r.rating)}<span className="text-ink/25">{"★".repeat(5 - r.rating)}</span>
                      <span className="sr-only"> {r.rating} out of 5</span>
                    </p>
                    <p className="text-sm text-ink/60">
                      {r.profiles?.full_name || "Guest"} on{" "}
                      <Link href={`/admin/properties/${r.property_id}`} className="text-forest-700 underline">{r.properties?.name ?? "a listing"}</Link>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.is_hidden ? <StatusBadge status="suspended" /> : null}
                    <time className="text-xs text-ink/45" dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
                  </div>
                </div>
                {r.comment ? <p className="whitespace-pre-line text-sm text-ink/80">{r.comment}</p> : null}
                <form action={moderateReview.bind(null, r.id, !r.is_hidden)}>
                  <button type="submit" className="text-sm text-forest-700 underline underline-offset-2">
                    {r.is_hidden ? "Restore review" : "Hide review"}
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
