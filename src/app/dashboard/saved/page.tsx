import type { Metadata } from "next";

import { EmptyState } from "@/components/app/ui";
import { StayCard } from "@/components/stays/stay-card";
import { requireUser } from "@/lib/auth";
import { removeSaved } from "@/app/dashboard/actions";
import type { SearchResult } from "@/lib/db/types";

export const metadata: Metadata = { title: "Saved stays" };

export default async function SavedPage() {
  const { supabase, user } = await requireUser("/dashboard/saved");
  const { data } = await supabase
    .from("saved_properties")
    .select("property_id, properties(id, slug, name, summary, city, state, region, price_inr, price_unit, max_guests, rooms_count, is_featured, is_sample, property_categories(slug, name), property_images(path, source, alt, sort_order))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  type Raw = { property_id: string; properties: (Omit<SearchResult, "category_slug" | "category_name" | "cover_path" | "cover_source" | "cover_alt" | "total_count"> & { property_categories: { slug: string; name: string } | null; property_images: { path: string; source: "storage" | "static"; alt: string | null; sort_order: number }[] }) | null };
  const items = ((data ?? []) as unknown as Raw[]).filter((r) => r.properties);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Saved stays</h1>
        <p className="mt-1 text-sm text-ink/60">Stays you&apos;ve bookmarked. Unpublished listings disappear from this list automatically.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nothing saved yet" description="Tap “Save” on any stay to keep it here." action={{ href: "/stays", label: "Explore stays" }} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ property_id, properties: p }) => {
            const cover = [...(p!.property_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
            const stay: SearchResult = { ...p!, category_slug: p!.property_categories?.slug ?? null, category_name: p!.property_categories?.name ?? null, cover_path: cover?.path ?? null, cover_source: cover?.source ?? null, cover_alt: cover?.alt ?? null, total_count: 1 };
            return (
              <div key={property_id} className="flex flex-col gap-2">
                <StayCard stay={stay} />
                <form action={removeSaved.bind(null, property_id)}>
                  <button type="submit" className="text-sm text-red-700 underline underline-offset-2">Remove from saved</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
