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

/** Public URL of a product photograph in the product-images bucket. */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

/** Shown only where a real photograph is missing. It is plainly a placeholder, never a picture of a product. */
export const PRODUCT_PLACEHOLDER = "";

/** Public URL of a service photograph in the service-images bucket. */
export function serviceImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/service-images/${path}`;
}
