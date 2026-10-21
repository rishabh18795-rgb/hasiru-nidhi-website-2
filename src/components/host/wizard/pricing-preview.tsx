"use client";

import { useState } from "react";

import { formatINR } from "@/lib/format";
import { quoteLines, quoteStay, type PricingRules } from "@/lib/pricing";

// Fixed reference dates (a Monday and a Friday) so the preview is identical on server and client.
const WEEKDAY = { in: "2030-01-07", out: "2030-01-09", label: "2 weekday nights (Mon–Wed)" };
const WEEKEND = { in: "2030-01-11", out: "2030-01-13", label: "2 weekend nights (Fri–Sun)" };

/** What a guest will see for a sample stay, computed with the same rules the database uses to price a booking. */
export function PricingPreview({ rules, maxGuests }: { rules: PricingRules; maxGuests: number }) {
  const [guests, setGuests] = useState(2);
  const g = Math.min(Math.max(1, guests || 1), maxGuests);
  return (
    <div className="rounded-2xl border border-sand-300 bg-sand-50 p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg text-forest-950">Guest-facing price preview</h3>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          Guests
          <input type="number" min={1} max={maxGuests} value={guests} onChange={(e) => setGuests(Number(e.target.value))}
            className="h-9 w-16 rounded-lg border border-forest-900/15 bg-white px-2 text-center" aria-label="Number of guests in the preview" />
        </label>
      </div>
      {rules.price_inr === null ? (
        <p className="mt-3 text-sm text-ink/65">Enter a price to see what guests will be shown.</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[WEEKDAY, WEEKEND].map((s) => {
            const q = quoteStay(rules, s.in, s.out, g);
            return (
              <div key={s.label} className="rounded-xl bg-white p-4 text-sm ring-1 ring-forest-900/8">
                <p className="font-medium text-forest-950">{s.label}</p>
                {q ? (
                  <>
                    <dl className="mt-2 space-y-1 text-ink/75">
                      {quoteLines(q).map((l) => (
                        <div key={l.label} className="flex justify-between gap-3"><dt>{l.label}</dt><dd>{formatINR(l.amount)}</dd></div>
                      ))}
                    </dl>
                    <p className="mt-2 flex justify-between border-t border-forest-900/10 pt-2 font-semibold text-forest-950"><span>Total</span><span>{formatINR(q.total)}</span></p>
                  </>
                ) : <p className="mt-2 text-ink/55">Not available with the current settings.</p>}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-ink/60">Shown to travellers as an estimate. Requests are never charged online; the host confirms every stay. Weekend nights are Friday and Saturday.</p>
    </div>
  );
}
