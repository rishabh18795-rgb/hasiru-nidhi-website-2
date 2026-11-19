import "server-only";

import { cache } from "react";

import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SHOP_PAGE_SIZE, type ShopFilters } from "@/lib/shop/filters";
import type { ProductCardData, ProductCategory, PublicProduct, VendorStore } from "@/lib/db/types";

export interface ShopSearchOutcome { results: ProductCardData[]; total: number; error: boolean }

/** Public, cookie-less reads. Shoppers only ever reach products through the database's public functions. */
export async function searchProducts(f: ShopFilters, category: string | null, extra: { featured?: boolean; limit?: number } = {}): Promise<ShopSearchOutcome> {
  if (!isSupabaseConfigured()) return { results: [], total: 0, error: false };
  try {
    const { data, error } = await createPublicSupabase(30).rpc("search_products", {
      p_query: f.q || null, p_category: category, p_vendor: f.vendor || null, p_min: f.min, p_max: f.max, p_in_stock: f.inStock,
      p_pin: f.pin || null, p_featured: extra.featured ?? false, p_sort: f.sort, p_limit: extra.limit ?? SHOP_PAGE_SIZE, p_offset: extra.limit ? 0 : (f.page - 1) * SHOP_PAGE_SIZE,
    });
    if (error) throw error;
    const results = (data ?? []) as ProductCardData[];
    return { results, total: results.length ? Number(results[0].total_count) : 0, error: false };
  } catch (err) {
    console.error("searchProducts failed", err);
    return { results: [], total: 0, error: true };
  }
}

export const getShopCategories = cache(async (): Promise<ProductCategory[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await createPublicSupabase(60).from("product_categories").select("id, slug, name, description, sort_order, is_active").eq("is_active", true).order("sort_order");
    return (data ?? []) as ProductCategory[];
  } catch {
    return [];
  }
});

export async function getPublicProduct(slug: string): Promise<PublicProduct | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const { data } = await createPublicSupabase(30).rpc("get_product_public", { p_slug: slug });
    return (data as PublicProduct | null) ?? null;
  } catch {
    return null;
  }
}

export async function getVendorStore(slug: string): Promise<VendorStore | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const { data } = await createPublicSupabase(30).rpc("get_vendor_store", { p_slug: slug });
    return (data as VendorStore | null) ?? null;
  } catch {
    return null;
  }
}
