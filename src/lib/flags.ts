import "server-only";

import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Marketplace feature flags live in platform_settings (public, boolean, all OFF by default) so an administrator controls
 * exposure and deploying code never exposes a module. Anything unreadable or unconfigured counts as OFF.
 */
export interface MarketplaceFlags {
  vendorRegistration: boolean;
  products: boolean;
  services: boolean;
}

export const FLAG_KEYS = {
  vendorRegistration: "marketplace_vendor_registration_enabled",
  products: "marketplace_products_enabled",
  services: "marketplace_services_enabled",
} as const satisfies Record<keyof MarketplaceFlags, string>;

export const ALL_OFF: MarketplaceFlags = { vendorRegistration: false, products: false, services: false };

export async function getMarketplaceFlags(): Promise<MarketplaceFlags> {
  if (!isSupabaseConfigured()) return ALL_OFF;
  try {
    const { data, error } = await createPublicSupabase(15).from("platform_settings").select("key, value").in("key", Object.values(FLAG_KEYS));
    if (error || !data) return ALL_OFF;
    const on = (key: string) => data.find((r) => r.key === key)?.value === true;
    return { vendorRegistration: on(FLAG_KEYS.vendorRegistration), products: on(FLAG_KEYS.products), services: on(FLAG_KEYS.services) };
  } catch {
    return ALL_OFF;
  }
}
