import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Amenity, Experience, Property, PropertyImage, PropertyPrivate, RoomType } from "@/lib/db/types";

export interface HostListing {
  property: Property;
  priv: Partial<PropertyPrivate>;
  images: PropertyImage[];
  amenityIds: number[];
  experienceIds: number[];
  amenities: Amenity[];
  experiences: Experience[];
  rooms: RoomType[];
  category: { slug: string; name: string } | null;
}

/**
 * Everything about one of the host's own listings. Row Level Security already limits every query to the owner;
 * the explicit host_id filter is defence in depth. Returns null for anything that isn't theirs.
 */
export async function loadHostListing(supabase: SupabaseClient, id: string, hostId: string): Promise<HostListing | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data: property } = await supabase.from("properties").select("*").eq("id", id).eq("host_id", hostId).maybeSingle();
  if (!property) return null;
  const p = property as Property;
  const [priv, am, ex, imgs, rooms, cat] = await Promise.all([
    supabase.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    supabase.from("property_amenities").select("amenity_id, amenities(id, slug, name, group_name)").eq("property_id", id),
    supabase.from("property_experiences").select("experience_id, experiences(id, slug, name, description)").eq("property_id", id),
    supabase.from("property_images").select("*").eq("property_id", id).order("sort_order").order("created_at"),
    supabase.from("room_types").select("*").eq("property_id", id).order("name"),
    p.category_id ? supabase.from("property_categories").select("slug, name").eq("id", p.category_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const amRows = (am.data ?? []) as unknown as { amenity_id: number; amenities: Amenity | null }[];
  const exRows = (ex.data ?? []) as unknown as { experience_id: number; experiences: Experience | null }[];
  return {
    property: p,
    priv: (priv.data ?? {}) as Partial<PropertyPrivate>,
    images: (imgs.data ?? []) as PropertyImage[],
    amenityIds: amRows.map((r) => r.amenity_id),
    experienceIds: exRows.map((r) => r.experience_id),
    amenities: amRows.map((r) => r.amenities).filter((x): x is Amenity => Boolean(x)),
    experiences: exRows.map((r) => r.experiences).filter((x): x is Experience => Boolean(x)),
    rooms: (rooms.data ?? []) as RoomType[],
    category: (cat.data as HostListing["category"]) ?? null,
  };
}
