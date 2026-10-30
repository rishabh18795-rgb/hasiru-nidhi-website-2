import raw from "../../../supabase/demo-properties.json";

import type { SearchResult } from "@/lib/db/types";
import type { PricingRules } from "@/lib/pricing";
import { addDays } from "@/lib/format";
import { PAGE_SIZE, type StayFilters } from "@/lib/stays/filters";
import { AMENITY_NAMES, CATEGORY_NAMES, EXPERIENCE_NAMES } from "@/lib/demo/vocabulary";

/**
 * Built-in DEMO MODE data: the same six fictional listings that supabase/seed.sql loads into a test database, read from the same
 * JSON file. It is used only by the explicitly labelled /demo/* pages. It is never merged into, or substituted for, results from
 * the live database.
 */
export interface DemoProperty {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  city: string;
  state: string;
  region: string;
  rooms: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  arrangement: string;
  max_guests: number;
  price_inr: number;
  price_unit: "per_night" | "per_person_night" | "per_day_visit";
  weekend_price_inr?: number;
  included_guests?: number;
  extra_guest_fee_inr?: number;
  cleaning_fee_inr?: number;
  tax_percent?: number;
  min_nights: number;
  max_nights: number;
  check_in: string;
  check_out: string;
  house_rules: string;
  cancellation_policy: "flexible" | "moderate" | "strict";
  featured: boolean;
  images: { path: string; alt: string }[];
  amenities: string[];
  experiences: string[];
  blocks: { from_days: number; to_days: number; reason: string }[];
}

export const demoProperties = raw.properties as DemoProperty[];

export const getDemoProperty = (slug: string): DemoProperty | null => demoProperties.find((p) => p.slug === slug) ?? null;

export const demoPricing = (d: DemoProperty): PricingRules => ({
  price_inr: d.price_inr, price_unit: d.price_unit, weekend_price_inr: d.weekend_price_inr ?? null, included_guests: d.included_guests ?? null,
  extra_guest_fee_inr: d.extra_guest_fee_inr ?? null, cleaning_fee_inr: d.cleaning_fee_inr ?? null, tax_percent: d.tax_percent ?? 0, currency: "INR",
});

/** Demo blocked ranges, relative to today so the calendar always shows upcoming dates. */
export const demoUnavailable = (d: DemoProperty, today: string) => d.blocks.map((b) => ({ start_date: addDays(today, b.from_days), end_date: addDays(today, b.to_days) }));

export const demoAmenityNames = (d: DemoProperty) => d.amenities.map((a) => AMENITY_NAMES[a] ?? a);
export const demoExperienceNames = (d: DemoProperty) => d.experiences.map((e) => EXPERIENCE_NAMES[e] ?? e);

export function demoToSearchResult(d: DemoProperty): SearchResult {
  return {
    id: d.slug, slug: d.slug, name: d.name, summary: d.summary, city: d.city, state: d.state, region: d.region,
    category_slug: d.category, category_name: CATEGORY_NAMES[d.category] ?? d.category, price_inr: d.price_inr, price_unit: d.price_unit,
    max_guests: d.max_guests, rooms_count: d.rooms, is_featured: d.featured, is_sample: true, bedrooms: d.bedrooms, bathrooms: d.bathrooms,
    amenity_names: demoAmenityNames(d), cover_path: d.images[0]?.path ?? null, cover_source: "static", cover_alt: d.images[0]?.alt ?? null, total_count: 0,
  };
}

const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase());

/** Same rules as the search_properties() database function, applied in memory (demo mode only). */
export function searchDemo(f: StayFilters, today: string): { results: SearchResult[]; total: number } {
  let list = demoProperties.filter((d) => {
    if (f.q && ![d.name, d.city, d.region, d.state, d.summary].some((x) => has(x, f.q))) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.min !== null && d.price_inr < f.min) return false;
    if (f.max !== null && d.price_inr > f.max) return false;
    if (f.guests !== null && d.max_guests < f.guests) return false;
    if (f.amenities.length && !f.amenities.every((a) => d.amenities.includes(a))) return false;
    if (f.experiences.length && !f.experiences.some((e) => d.experiences.includes(e))) return false;
    if (f.checkin && f.checkout && demoUnavailable(d, today).some((r) => r.start_date < f.checkout && f.checkin < r.end_date)) return false;
    return true;
  });
  const byName = (a: DemoProperty, b: DemoProperty) => a.name.localeCompare(b.name);
  list = [...list].sort(
    f.sort === "price_asc" ? (a, b) => a.price_inr - b.price_inr
    : f.sort === "price_desc" ? (a, b) => b.price_inr - a.price_inr
    : (a, b) => Number(b.featured) - Number(a.featured) || byName(a, b),
  );
  const total = list.length;
  const page = list.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE).map(demoToSearchResult);
  return { results: page.map((r) => ({ ...r, total_count: total })), total };
}

export const demoCatalog = () => ({
  categories: Object.entries(CATEGORY_NAMES).filter(([slug]) => demoProperties.some((d) => d.category === slug)).map(([slug, name], i) => ({ id: i + 1, slug, name, description: null })),
  amenities: Object.entries(AMENITY_NAMES).filter(([slug]) => demoProperties.some((d) => d.amenities.includes(slug))).map(([slug, name], i) => ({ id: i + 1, slug, name, group_name: "all" })),
  experiences: Object.entries(EXPERIENCE_NAMES).filter(([slug]) => demoProperties.some((d) => d.experiences.includes(slug))).map(([slug, name], i) => ({ id: i + 1, slug, name, description: null })),
});
