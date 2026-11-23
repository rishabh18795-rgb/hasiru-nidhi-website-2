import "server-only";

import { cache } from "react";

import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SERVICE_PAGE_SIZE, type ServiceFilters } from "@/lib/services/filters";
import type { PublicService, ServiceCardData, ServiceCategory, ServiceSlot } from "@/lib/db/types";

export interface ServiceSearchOutcome { results: ServiceCardData[]; total: number; error: boolean }

/** Public, cookie-less reads. Visitors only ever reach services through the database's public functions. */
export async function searchServices(f: ServiceFilters, extra: { featured?: boolean; limit?: number } = {}): Promise<ServiceSearchOutcome> {
  if (!isSupabaseConfigured()) return { results: [], total: 0, error: false };
  try {
    const { data, error } = await createPublicSupabase(30).rpc("search_services", {
      p_query: f.q || null, p_category: f.category || null, p_vendor: f.vendor || null, p_pricing: f.pricing || null, p_pin: f.pin || null,
      p_featured: extra.featured ?? false, p_sort: f.sort, p_limit: extra.limit ?? SERVICE_PAGE_SIZE, p_offset: extra.limit ? 0 : (f.page - 1) * SERVICE_PAGE_SIZE,
    });
    if (error) throw error;
    const results = (data ?? []) as ServiceCardData[];
    return { results, total: results.length ? Number(results[0].total_count) : 0, error: false };
  } catch (err) {
    console.error("searchServices failed", err);
    return { results: [], total: 0, error: true };
  }
}

export const getServiceCategories = cache(async (): Promise<ServiceCategory[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await createPublicSupabase(60).from("service_categories").select("id, slug, name, description, sort_order, is_active").eq("is_active", true).order("sort_order");
    return (data ?? []) as ServiceCategory[];
  } catch {
    return [];
  }
});

export async function getPublicService(slug: string): Promise<PublicService | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const { data } = await createPublicSupabase(30).rpc("get_service_public", { p_slug: slug });
    return (data as PublicService | null) ?? null;
  } catch {
    return null;
  }
}

export async function getServiceSlots(serviceId: string, days = 14): Promise<ServiceSlot[]> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/.test(serviceId)) return [];
  try {
    const { data } = await createPublicSupabase(15).rpc("get_service_slots", { p_service: serviceId, p_from: null, p_days: days });
    return (data ?? []) as ServiceSlot[];
  } catch {
    return [];
  }
}
