import { cache } from "react";

import { createPublicSupabase, createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PAGE_SIZE, type StayFilters } from "@/lib/stays/filters";
import type { Property, PropertyImage, RoomType, SearchResult, Amenity, Experience } from "@/lib/db/types";

export interface StaySearchOutcome {
  results: SearchResult[];
  total: number;
  error: boolean;
  configured: boolean;
}

export async function searchStays(f: StayFilters): Promise<StaySearchOutcome> {
  if (!isSupabaseConfigured()) return { results: [], total: 0, error: false, configured: false };
  try {
    // Uses the caller's session when present, so RLS stays authoritative either way.
    const db = await createServerSupabase();
    const { data, error } = await db.rpc("search_properties", {
      p_query: f.q || null,
      p_category: f.category || null,
      p_min_price: f.min,
      p_max_price: f.max,
      p_guests: f.guests,
      p_amenities: f.amenities.length ? f.amenities : null,
      p_experiences: f.experiences.length ? f.experiences : null,
      p_check_in: f.checkin && f.checkout ? f.checkin : null,
      p_check_out: f.checkin && f.checkout ? f.checkout : null,
      p_sort: f.sort,
      p_limit: PAGE_SIZE,
      p_offset: (f.page - 1) * PAGE_SIZE,
    });
    if (error) throw error;
    const results = ((data ?? []) as SearchResult[]).map((r) => ({ ...r, total_count: Number(r.total_count) }));
    return { results, total: results[0]?.total_count ?? 0, error: false, configured: true };
  } catch (err) {
    console.error("searchStays failed", err);
    return { results: [], total: 0, error: true, configured: true };
  }
}

export interface StayDetail {
  property: Property;
  category: { slug: string; name: string } | null;
  images: PropertyImage[];
  amenities: Amenity[];
  experiences: Experience[];
  rooms: RoomType[];
  host: { id: string; full_name: string; host_verified: boolean } | null;
  reviews: { id: string; rating: number; comment: string | null; created_at: string }[];
  ratingAverage: number | null;
  unavailable: { start_date: string; end_date: string }[];
}

export const getStayBySlug = cache(async function getStayBySlug(slug: string): Promise<StayDetail | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const db = await createServerSupabase();
    const { data: property } = await db.from("properties").select("*").eq("slug", slug).maybeSingle();
    if (!property) return null;
    const p = property as Property;
    const [cat, images, amenities, experiences, rooms, host, reviews, unavailable] = await Promise.all([
      p.category_id
        ? db.from("property_categories").select("slug, name").eq("id", p.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("property_images").select("*").eq("property_id", p.id).order("sort_order").order("created_at"),
      db.from("property_amenities").select("amenities(id, slug, name, group_name)").eq("property_id", p.id),
      db.from("property_experiences").select("experiences(id, slug, name, description)").eq("property_id", p.id),
      db.from("room_types").select("*").eq("property_id", p.id),
      p.host_id
        ? db.from("host_public_profiles").select("id, full_name, host_verified").eq("id", p.host_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("reviews").select("id, rating, comment, created_at").eq("property_id", p.id).eq("is_hidden", false).order("created_at", { ascending: false }).limit(20),
      db.rpc("property_unavailable_ranges", { p_property: p.id }),
    ]);
    const reviewRows = (reviews.data ?? []) as StayDetail["reviews"];
    const ratingAverage = reviewRows.length ? reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length : null;
    const pick = <T,>(rows: unknown[] | null, key: string): T[] =>
      (rows ?? []).map((r) => (r as Record<string, T>)[key]).filter(Boolean);
    return {
      property: p,
      category: (cat.data as StayDetail["category"]) ?? null,
      images: (images.data ?? []) as PropertyImage[],
      amenities: pick<Amenity>(amenities.data, "amenities"),
      experiences: pick<Experience>(experiences.data, "experiences"),
      rooms: (rooms.data ?? []) as RoomType[],
      host: (host.data as StayDetail["host"]) ?? null,
      reviews: reviewRows,
      ratingAverage,
      unavailable: (unavailable.data ?? []) as StayDetail["unavailable"],
    };
  } catch (err) {
    console.error("getStayBySlug failed", err);
    return null;
  }
});

export async function getSimilarStays(property: Property, limit = 3): Promise<SearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const db = createPublicSupabase(120);
    const { data } = await db.rpc("search_properties", { p_sort: "featured", p_limit: limit + 1 });
    return ((data ?? []) as SearchResult[]).filter((r) => r.id !== property.id).slice(0, limit);
  } catch {
    return [];
  }
}

/** Slugs of live listings for the sitemap. */
export async function listApprovedSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await createPublicSupabase(600)
      .from("properties")
      .select("slug, updated_at")
      .eq("status", "approved")
      .eq("is_sample", false)
      .limit(2000);
    return (data ?? []) as { slug: string; updated_at: string }[];
  } catch {
    return [];
  }
}

/** Featured live listings for the home page (public, cookie-less so the page can stay cached). */
export async function getFeaturedStays(limit = 3): Promise<SearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await createPublicSupabase(120).rpc("search_properties", { p_sort: "featured", p_limit: limit });
    return ((data ?? []) as SearchResult[]).map((r) => ({ ...r, total_count: Number(r.total_count) }));
  } catch {
    return [];
  }
}
