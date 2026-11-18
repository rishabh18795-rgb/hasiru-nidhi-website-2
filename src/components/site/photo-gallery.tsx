"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface PhotoItem {
  src: string;
  alt: string;
  caption: string;
  category: string;
}

/**
 * Filterable photo grid with an accessible lightbox.
 * Native <dialog> gives a focus trap and Esc to close; arrow keys and touch swipe move between photos.
 */
export function PhotoGallery({ items, categories }: { items: PhotoItem[]; categories: string[] }) {
  const [active, setActive] = useState("All");
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  const visible = useMemo(() => (active === "All" ? items : items.filter((i) => i.category === active)), [items, active]);
  const count = visible.length;

  const step = useCallback((d: number) => setIndex((i) => (count ? (i + d + count) % count : 0)), [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!dialogRef.current?.open) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };

  const current = visible[index];

  return (
    <div>
      <div role="group" aria-label="Filter photographs by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={active === c}
            onClick={() => { setActive(c); setIndex(0); }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
              active === c ? "bg-forest-800 text-cream" : "bg-white text-forest-900 ring-1 ring-forest-900/15 hover:bg-forest-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink/60" aria-live="polite" data-testid="gallery-count">
        Showing {count} {count === 1 ? "photograph" : "photographs"}{active === "All" ? "" : ` in ${active}`}
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {visible.map((item, i) => (
          <li key={item.src + item.caption}>
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`Open photograph: ${item.caption}`}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-forest-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-forest-500"
            >
              <Image src={item.src} alt={item.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest-950/75 to-transparent p-3 text-left text-xs text-cream sm:text-sm">{item.caption}</span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label="Photograph viewer"
        className="m-auto h-[92vh] w-[96vw] max-w-6xl overflow-hidden rounded-2xl bg-forest-950 p-0 text-cream backdrop:bg-black/80"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      >
        {current ? (
          <div
            className="relative flex h-full flex-col"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span aria-live="polite">Photograph {index + 1} of {count}</span>
              <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close viewer" className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-400">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="relative flex-1">
              <Image key={current.src} src={current.src} alt={current.alt} fill sizes="96vw" className="object-contain" />
            </div>
            {count > 1 ? (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="Previous photograph" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-400">
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next photograph" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-400">
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null}
            <p className="px-4 py-3 text-center text-sm text-cream/80">{current.caption}</p>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
