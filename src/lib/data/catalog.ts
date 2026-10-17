import { createPublicSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Amenity, Category, Experience } from "@/lib/db/types";
import { siteConfig } from "@/lib/site";

export interface Catalog {
  categories: Category[];
  amenities: Amenity[];
  experiences: Experience[];
}

const EMPTY: Catalog = { categories: [], amenities: [], experiences: [] };

export async function getCatalog(): Promise<Catalog> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const db = createPublicSupabase(300);
    const [c, a, e] = await Promise.all([
      db.from("property_categories").select("id, slug, name, description").eq("is_active", true).order("sort_order"),
      db.from("amenities").select("id, slug, name, group_name").eq("is_active", true).order("sort_order"),
      db.from("experiences").select("id, slug, name, description").eq("is_active", true).order("sort_order"),
    ]);
    return {
      categories: (c.data ?? []) as Category[],
      amenities: (a.data ?? []) as Amenity[],
      experiences: (e.data ?? []) as Experience[],
    };
  } catch (err) {
    console.error("getCatalog failed", err);
    return EMPTY;
  }
}

export interface PublicSettings {
  whatsapp_number: string;
  support_email: string;
  support_phone: string;
  announcement: string;
}

/** Admin-editable public settings, layered over environment values. Never throws. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const fromEnv: PublicSettings = {
    whatsapp_number: siteConfig.contact.whatsappNumber,
    support_email: siteConfig.contact.email,
    support_phone: siteConfig.contact.phone,
    announcement: "",
  };
  if (!isSupabaseConfigured()) return fromEnv;
  try {
    const { data } = await createPublicSupabase(60).from("platform_settings").select("key, value").eq("is_public", true);
    const out = { ...fromEnv };
    for (const row of data ?? []) {
      const value = typeof row.value === "string" ? row.value.trim() : "";
      if (value && row.key in out) (out as Record<string, string>)[row.key] = value;
    }
    out.whatsapp_number = out.whatsapp_number.replace(/\D/g, "");
    return out;
  } catch (err) {
    console.error("getPublicSettings failed", err);
    return fromEnv;
  }
}
