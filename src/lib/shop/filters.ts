export const SHOP_PAGE_SIZE = 12;

export const SHOP_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name A to Z" },
] as const;

export interface ShopFilters {
  q: string;
  pin: string;
  min: number | null;
  max: number | null;
  inStock: boolean;
  vendor: string;
  sort: (typeof SHOP_SORTS)[number]["value"];
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const num = (v: string, max: number): number | null => (/^\d{1,9}(\.\d{1,2})?$/.test(v) && Number(v) <= max ? Number(v) : null);

/** Parses and sanitises URL params so they are safe to pass to search_products(). */
export function parseShopFilters(raw: Raw): ShopFilters {
  const sort = first(raw.sort);
  const page = /^\d{1,4}$/.test(first(raw.page)) ? Math.max(1, Number(first(raw.page))) : 1;
  let min = num(first(raw.min), 10000000);
  let max = num(first(raw.max), 10000000);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    q: first(raw.q).trim().slice(0, 80),
    pin: /^\d{6}$/.test(first(raw.pin).trim()) ? first(raw.pin).trim() : "",
    min, max,
    inStock: first(raw.stock) === "1",
    vendor: /^[a-z0-9-]{1,80}$/.test(first(raw.vendor)) ? first(raw.vendor) : "",
    sort: (SHOP_SORTS.find((s) => s.value === sort)?.value ?? "newest"),
    page,
  };
}

export function shopFiltersToQuery(f: Partial<ShopFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.pin) p.set("pin", f.pin);
  if (f.min !== null && f.min !== undefined) p.set("min", String(f.min));
  if (f.max !== null && f.max !== undefined) p.set("max", String(f.max));
  if (f.inStock) p.set("stock", "1");
  if (f.vendor) p.set("vendor", f.vendor);
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function activeShopFilterCount(f: ShopFilters): number {
  return [f.pin, f.min !== null, f.max !== null, f.inStock, f.vendor].filter(Boolean).length;
}
