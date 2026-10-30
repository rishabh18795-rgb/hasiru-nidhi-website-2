"use client";

import { useId, useState } from "react";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";

import { addDays, todayIST } from "@/lib/stays/filters";
import { cn } from "@/lib/utils";

interface Props {
  q?: string;
  checkin?: string;
  checkout?: string;
  guests?: number | null;
  /** Extra filter values preserved when the bar is used inside /stays. */
  hidden?: Record<string, string | undefined>;
  tone?: "light" | "dark";
}

export interface SearchProblems { dates?: string; guests?: string }

/** Pure rules for the search form (also enforced again by the stays page when it reads the URL). */
export function validateSearch(v: { checkin: string; checkout: string; guests: string }, today: string): SearchProblems {
  const out: SearchProblems = {};
  if (v.checkin && !v.checkout) out.dates = "Select a check-out date.";
  else if (!v.checkin && v.checkout) out.dates = "Select a check-in date.";
  else if (v.checkin && v.checkout) {
    if (v.checkin < today) out.dates = "Check-in can't be in the past.";
    else if (v.checkout <= v.checkin) out.dates = "Check-out must be after check-in.";
  }
  if (v.guests.trim() !== "") {
    const n = Number(v.guests);
    if (!Number.isInteger(n) || n < 1 || n > 500) out.guests = "Enter a number of guests between 1 and 500.";
  }
  return out;
}

/**
 * A date input whose empty state reads as words ("Select check-in date") instead of the browser's "dd/mm/yyyy".
 * It stays a real native date input (so the picker works on every device); only its empty text is replaced.
 */
function DateField({ id, name, label, value, onChange, min, placeholder, inputClass, invalid, describedBy }: {
  id: string; name: string; label: string; value: string; onChange: (v: string) => void; min: string; placeholder: string; inputClass: string; invalid: boolean; describedBy?: string;
}) {
  const [focused, setFocused] = useState(false);
  const empty = value === "" && !focused;
  return (
    <div className="relative">
      <input
        id={id} name={name} type="date" value={value} min={min}
        onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        className={cn(inputClass, empty && "text-transparent")}
      />
      {empty ? <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 right-7 flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-sm text-ink/50">{placeholder}</span> : null}
    </div>
  );
}

/**
 * Search form → GET /stays. Every field has a visible label; it submits the real filters in the URL (so it works with a
 * stale cache or without JavaScript) and refuses impossible input with a clear message before leaving the page.
 */
export function StaySearchBar({ q = "", checkin = "", checkout = "", guests, hidden = {}, tone = "light" }: Props) {
  const today = todayIST();
  const uid = useId();
  const [ci, setCi] = useState(checkin);
  const [co, setCo] = useState(checkout);
  const [gs, setGs] = useState(guests ? String(guests) : "");
  const [problems, setProblems] = useState<SearchProblems>({});

  const cell = "flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3.5 py-2";
  const labelCls = "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-forest-700";
  const input = "h-7 w-full min-w-0 truncate bg-transparent text-sm text-forest-950 outline-none placeholder:text-ink/50";
  const divider = "md:border-l md:border-forest-900/10";
  const errId = `${uid}-err`;

  return (
    <div className="w-full">
      <form
        action="/stays"
        method="get"
        role="search"
        aria-label="Search stays"
        noValidate
        onSubmit={(e) => {
          const found = validateSearch({ checkin: ci, checkout: co, guests: gs }, today);
          setProblems(found);
          if (found.dates || found.guests) e.preventDefault();
        }}
        className={cn(
          "grid w-full grid-cols-2 gap-1 rounded-3xl p-2 shadow-xl shadow-forest-950/10 md:flex md:items-stretch md:gap-0 md:rounded-full",
          tone === "dark" ? "bg-cream/95 backdrop-blur" : "bg-white ring-1 ring-forest-900/10",
        )}
      >
        {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <div className={cn(cell, "col-span-2 md:flex-[1.5]")}>
          <label htmlFor={`${uid}-q`} className={labelCls}><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location</label>
          <input id={`${uid}-q`} name="q" defaultValue={q} placeholder="Enter city, region or property name" className={input} maxLength={100} autoComplete="off" />
        </div>
        <div className={cn(cell, divider, "col-span-2 sm:col-span-1 md:flex-[1.15]")}>
          <label htmlFor={`${uid}-in`} className={labelCls}><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Check-in</label>
          <DateField id={`${uid}-in`} name="checkin" label="Check-in date" value={ci} onChange={setCi} min={today} placeholder="Select check-in date" inputClass={input} invalid={Boolean(problems.dates)} describedBy={problems.dates ? errId : undefined} />
        </div>
        <div className={cn(cell, divider, "col-span-2 sm:col-span-1 md:flex-[1.15]")}>
          <label htmlFor={`${uid}-out`} className={labelCls}><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Check-out</label>
          <DateField id={`${uid}-out`} name="checkout" label="Check-out date" value={co} onChange={setCo} min={ci ? addDays(ci, 1) : addDays(today, 1)} placeholder="Select check-out date" inputClass={input} invalid={Boolean(problems.dates)} describedBy={problems.dates ? errId : undefined} />
        </div>
        <div className={cn(cell, "col-span-2 md:col-span-1 md:max-w-[11rem]", divider)}>
          <label htmlFor={`${uid}-g`} className={labelCls}><Users className="h-3.5 w-3.5" aria-hidden="true" /> Guests</label>
          <input id={`${uid}-g`} type="number" name="guests" min={1} max={500} step={1} inputMode="numeric" value={gs} onChange={(e) => setGs(e.target.value)} placeholder="Number of guests" aria-invalid={Boolean(problems.guests) || undefined} aria-describedby={problems.guests ? errId : undefined} className={input} />
        </div>
        <button type="submit" className="col-span-2 inline-flex h-12 shrink-0 items-center justify-center gap-2 self-center rounded-full bg-forest-800 px-7 text-sm font-medium text-cream transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40 md:col-span-1">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search Stays
        </button>
      </form>
      {problems.dates || problems.guests ? (
        <p id={errId} role="alert" className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">{[problems.dates, problems.guests].filter(Boolean).join(" ")}</p>
      ) : null}
    </div>
  );
}
