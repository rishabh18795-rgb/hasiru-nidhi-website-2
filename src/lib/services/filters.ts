export const SERVICE_PAGE_SIZE = 12;

export const SERVICE_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name A to Z" },
] as const;

export interface ServiceFilters {
  q: string;
  pin: string;
  pricing: "" | "fixed" | "quote";
  vendor: string;
  category: string;
  sort: (typeof SERVICE_SORTS)[number]["value"];
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/** Parses and sanitises URL params so they are safe to pass to search_services(). */
export function parseServiceFilters(raw: Raw): ServiceFilters {
  const sort = first(raw.sort);
  const pricing = first(raw.pricing);
  const page = /^\d{1,4}$/.test(first(raw.page)) ? Math.max(1, Number(first(raw.page))) : 1;
  return {
    q: first(raw.q).trim().slice(0, 80),
    pin: /^\d{6}$/.test(first(raw.pin).trim()) ? first(raw.pin).trim() : "",
    pricing: pricing === "fixed" || pricing === "quote" ? pricing : "",
    vendor: /^[a-z0-9-]{1,80}$/.test(first(raw.vendor)) ? first(raw.vendor) : "",
    category: /^[a-z0-9-]{1,60}$/.test(first(raw.category)) ? first(raw.category) : "",
    sort: SERVICE_SORTS.find((s) => s.value === sort)?.value ?? "newest",
    page,
  };
}

export function serviceFiltersToQuery(f: Partial<ServiceFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.pin) p.set("pin", f.pin);
  if (f.pricing) p.set("pricing", f.pricing);
  if (f.vendor) p.set("vendor", f.vendor);
  if (f.category) p.set("category", f.category);
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function activeServiceFilterCount(f: ServiceFilters): number {
  return [f.pin, f.pricing, f.vendor].filter(Boolean).length;
}
