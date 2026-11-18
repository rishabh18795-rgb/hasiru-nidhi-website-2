"use client";

import { Children, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A touch-friendly, keyboard-operable carousel for REAL listings only (the page does not render it when there is no inventory).
 * It is plain CSS scroll-snap, so swiping works natively; the buttons and arrow keys scroll one card at a time.
 */
export function StayCarousel({ label, children }: { label: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const scrollBy = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? el.clientWidth) + 24), behavior: "smooth" });
  };
  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} className="relative">
      <div
        ref={track}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); scrollBy(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); scrollBy(-1); }
        }}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-500 [scrollbar-width:thin]"
      >
        {items.map((child, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}`} className="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-[31.5%]">
            {child}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous stays" className="glass inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-forest-500"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="Next stays" className="glass inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-forest-500"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      ) : null}
    </div>
  );
}
