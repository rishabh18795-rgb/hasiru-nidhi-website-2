import { basePath } from "@/lib/base-path";

/** Resolves a property image row to a URL: bundled static files, or a public Supabase Storage object. */
export function propertyImageUrl(path: string | null | undefined, source: "storage" | "static" | null | undefined): string | null {
  if (!path) return null;
  if (source === "static") return `${basePath}${path}`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/property-images/${path}`;
}

export const FALLBACK_PROPERTY_IMAGE = `${basePath}/images/stay/farmhouse-cottage-courtyard-karnataka.jpg`;
