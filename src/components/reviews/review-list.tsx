import { Star } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { PublicReviews } from "@/lib/db/types";

export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${className} ${n <= Math.round(value) ? "fill-sand-400 text-sand-400" : "text-forest-900/20"}`} aria-hidden="true" />)}
    </span>
  );
}

/** Approved, verified reviews only. When there are none it says so plainly: no placeholder testimonials, ever. */
export function ReviewList({ reviews, noun }: { reviews: PublicReviews | null; noun: "product" | "service" }) {
  if (!reviews) return null;
  const avg = reviews.average === null ? null : Number(reviews.average);
  return (
    <section aria-labelledby="reviews-heading" data-testid="reviews">
      <h2 id="reviews-heading" className="font-display text-2xl text-forest-950">Customer reviews</h2>
      {reviews.count === 0 ? (
        <p className="mt-3 text-sm text-ink/65">No reviews yet. Only customers who received this {noun === "product" ? "product" : "service"} can review it, and every review is checked before it appears.</p>
      ) : (
        <>
          <p className="mt-3 flex items-center gap-2 text-sm text-ink/75"><Stars value={avg ?? 0} className="h-5 w-5" /> <span className="font-medium text-forest-950" data-testid="review-average">{avg?.toFixed(1)}</span> out of 5 · {reviews.count} {reviews.count === 1 ? "review" : "reviews"}</p>
          <ul className="mt-4 divide-y divide-forest-900/10 rounded-2xl border border-forest-900/10 bg-white">
            {reviews.reviews.map((r, i) => (
              <li key={i} className="p-5" data-testid="review">
                <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-ink/65">{formatDate(r.created_at)}</span></div>
                {r.title ? <p className="mt-2 font-medium text-forest-950">{r.title}</p> : null}
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink/80">{r.body}</p>
                <p className="mt-2 text-xs text-ink/65">{r.author} · {noun === "product" ? "Verified purchase" : "Completed service"}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
