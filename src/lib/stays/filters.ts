import { addDays, todayIST } from "@/lib/format";

export const SORT_OPTIONS = [
  { value: "featured", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export const PAGE_SIZE = 12;

export interface StayFilters {
  q: string;
  category: string;
  min: number | null;
  max: number | null;
  guests: number | null;
  amenities: string[];
  experiences: string[];
  checkin: string;
  checkout: string;
  sort: (typeof SORT_OPTIONS)[number]["value"];
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const list = (v: string | string[] | undefined): string[] =>
  Array.from(
    new Set(
      (Array.isArray(v) ? v : [v ?? ""])
        .flatMap((x) => x.split(","))
        .map((x) => x.trim().toLowerCase())
        .filter((x) => /^[a-z0-9-]{1,60}$/.test(x)),
    ),
  ).slice(0, 20);
const intOrNull = (v: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};
const isoOrEmpty = (v: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/** Parses and sanitises URL search params so they are safe to pass into the search RPC. */
export function parseStayFilters(raw: RawParams, now: Date = new Date()): StayFilters {
  const today = todayIST(now);
  let checkin = isoOrEmpty(first(raw.checkin));
  let checkout = isoOrEmpty(first(raw.checkout));
  if (checkin && checkin < today) checkin = "";
  if (!checkin || !checkout || checkout <= checkin) {
    if (checkin && !checkout) checkout = "";
    else if (checkout && checkout <= checkin) checkout = "";
  }
  if (!checkin) checkout = "";
  const sort = first(raw.sort);
  return {
    q: first(raw.q).trim().slice(0, 100),
    category: /^[a-z0-9-]{1,60}$/.test(first(raw.category)) ? first(raw.category) : "",
    min: intOrNull(first(raw.min), 0, 10_000_000),
    max: intOrNull(first(raw.max), 0, 10_000_000),
    guests: intOrNull(first(raw.guests), 1, 500),
    amenities: list(raw.amenities),
    experiences: list(raw.experiences),
    checkin,
    checkout,
    sort: (SORT_OPTIONS.find((o) => o.value === sort)?.value ?? "featured") as StayFilters["sort"],
    page: Math.max(1, intOrNull(first(raw.page), 1, 1000) ?? 1),
  };
}

/** Builds a query string that round-trips through parseStayFilters. Empty values are omitted. */
export function stayFiltersToQuery(f: Partial<StayFilters>): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.category) params.set("category", f.category);
  if (f.min !== null && f.min !== undefined) params.set("min", String(f.min));
  if (f.max !== null && f.max !== undefined) params.set("max", String(f.max));
  if (f.guests) params.set("guests", String(f.guests));
  if (f.amenities?.length) params.set("amenities", f.amenities.join(","));
  if (f.experiences?.length) params.set("experiences", f.experiences.join(","));
  if (f.checkin) params.set("checkin", f.checkin);
  if (f.checkout) params.set("checkout", f.checkout);
  if (f.sort && f.sort !== "featured") params.set("sort", f.sort);
  if (f.page && f.page > 1) params.set("page", String(f.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function activeFilterCount(f: StayFilters): number {
  return [
    f.category,
    f.min !== null,
    f.max !== null,
    f.guests,
    f.amenities.length,
    f.experiences.length,
    f.checkin && f.checkout,
  ].filter(Boolean).length;
}

export { addDays, todayIST };
