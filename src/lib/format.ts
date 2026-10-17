const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? inr.format(n) : "";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // Dates arrive as YYYY-MM-DD (no time zone) — format them without shifting the day.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function utcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((utcDay(checkOut) - utcDay(checkIn)) / 86_400_000);
}

/** Today's date in India (YYYY-MM-DD) — the timezone the database uses for booking rules. */
export function todayIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export const PRICE_UNIT_LABEL: Record<string, string> = {
  per_night: "per night",
  per_person_night: "per person / night",
  per_day_visit: "per person (day visit)",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Live",
  rejected: "Rejected",
  suspended: "Suspended",
  requested: "Awaiting host",
  confirmed: "Confirmed",
  cancelled_by_traveller: "Cancelled by guest",
  cancelled_by_host: "Cancelled by host",
  completed: "Completed",
};
