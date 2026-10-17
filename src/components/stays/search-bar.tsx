import { CalendarDays, MapPin, Search, Users } from "lucide-react";

import { addDays, todayIST } from "@/lib/stays/filters";

interface Props {
  q?: string;
  checkin?: string;
  checkout?: string;
  guests?: number | null;
  /** Extra filter values preserved when the bar is used inside /stays. */
  hidden?: Record<string, string | undefined>;
  tone?: "light" | "dark";
}

/** Plain GET form → /stays. Works without JavaScript and keeps every value in the URL. */
export function StaySearchBar({ q = "", checkin = "", checkout = "", guests, hidden = {}, tone = "light" }: Props) {
  const today = todayIST();
  const field = "flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5";
  const input = "w-full bg-transparent text-sm text-forest-950 outline-none placeholder:text-ink/45";
  return (
    <form
      action="/stays"
      method="get"
      role="search"
      aria-label="Search stays"
      className={`flex w-full flex-col gap-1 rounded-3xl p-2 shadow-xl shadow-forest-950/10 md:flex-row md:items-stretch md:rounded-full ${tone === "dark" ? "bg-cream/95 backdrop-blur" : "bg-white ring-1 ring-forest-900/10"}`}
    >
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className={`${field} md:flex-[1.4]`}>
        <MapPin className="h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
        <span className="sr-only">Destination, city or property</span>
        <input name="q" defaultValue={q} placeholder="Where to? City, region or property" className={input} maxLength={100} />
      </label>
      <label className={`${field} md:border-l md:border-forest-900/10`}>
        <CalendarDays className="h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
        <span className="sr-only">Check-in date</span>
        <input type="date" name="checkin" defaultValue={checkin} min={today} aria-label="Check-in" className={input} />
      </label>
      <label className={`${field} md:border-l md:border-forest-900/10`}>
        <CalendarDays className="h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
        <span className="sr-only">Check-out date</span>
        <input type="date" name="checkout" defaultValue={checkout} min={checkin ? addDays(checkin, 1) : addDays(today, 1)} aria-label="Check-out" className={input} />
      </label>
      <label className={`${field} md:max-w-[9rem] md:border-l md:border-forest-900/10`}>
        <Users className="h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
        <span className="sr-only">Number of guests</span>
        <input type="number" name="guests" min={1} max={500} defaultValue={guests ?? ""} placeholder="Guests" className={input} />
      </label>
      <button type="submit" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-forest-800 px-7 text-sm font-medium text-cream transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40">
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
