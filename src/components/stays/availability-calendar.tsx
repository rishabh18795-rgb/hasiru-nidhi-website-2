import { addDays, todayIST } from "@/lib/stays/filters";

interface Range {
  start_date: string;
  end_date: string; // exclusive
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthMatrix(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10));
  return cells;
}

/** Read-only calendar: days that are booked or blocked are struck through. Host reasons are never shown. */
export function AvailabilityCalendar({ ranges, months = 3 }: { ranges: Range[]; months?: number }) {
  const today = todayIST();
  const [ty, tm] = today.split("-").map(Number);
  const unavailable = new Set<string>();
  for (const r of ranges) for (let d = r.start_date; d < r.end_date; d = addDays(d, 1)) unavailable.add(d);

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: months }).map((_, i) => {
          const date = new Date(Date.UTC(ty, tm - 1 + i, 1));
          const y = date.getUTCFullYear();
          const m = date.getUTCMonth();
          const label = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
          return (
            <div key={label} role="group" aria-label={label}>
              <p className="mb-2 text-sm font-medium text-forest-950">{label}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink/45">
                {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
                {monthMatrix(y, m).map((iso, idx) =>
                  iso === null ? (
                    <span key={`b${idx}`} />
                  ) : (
                    <span
                      key={iso}
                      title={iso < today ? "Past" : unavailable.has(iso) ? "Unavailable" : "Available"}
                      className={`rounded-md py-1.5 ${
                        iso < today ? "text-ink/25" : unavailable.has(iso) ? "bg-stone-100 text-ink/35 line-through" : "bg-forest-50 text-forest-900"
                      }`}
                    >
                      {Number(iso.slice(8))}
                      {unavailable.has(iso) && iso >= today ? <span className="sr-only"> unavailable</span> : null}
                    </span>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink/55">Struck-through dates are already booked or blocked. Availability is final only when the host confirms your request.</p>
    </div>
  );
}
