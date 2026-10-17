"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export interface GalleryImage {
  src: string;
  alt: string;
}

/** Image grid with an accessible lightbox (native <dialog>: focus trap, Esc to close, arrow keys to navigate). */
export function StayGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const step = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (!dlg.open) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (count === 0) return null;
  const grid = images.slice(0, 5);

  return (
    <>
      <div className={`grid gap-2 overflow-hidden rounded-3xl ${count === 1 ? "" : "md:grid-cols-4 md:grid-rows-2"}`}>
        {grid.map((img, i) => (
          <button
            key={img.src + i}
            type="button"
            onClick={() => open(i)}
            aria-label={`Open photo ${i + 1} of ${count}: ${img.alt}`}
            className={`group relative block overflow-hidden bg-forest-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-forest-500 ${
              i === 0 ? (count === 1 ? "aspect-[16/9]" : "aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto md:min-h-[26rem]") : "hidden aspect-[4/3] md:block"
            }`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              priority={i === 0}
              sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "25vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {i === grid.length - 1 && count > grid.length ? (
              <span className="absolute inset-0 hidden items-center justify-center bg-forest-950/55 text-sm font-medium text-cream md:flex">
                <Expand className="mr-2 h-4 w-4" aria-hidden="true" /> Show all {count} photos
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {count > 1 ? (
        <button type="button" onClick={() => open(0)} className="mt-3 text-sm font-medium text-forest-800 underline underline-offset-2 md:hidden">
          View all {count} photos
        </button>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={`${name} photo gallery`}
        className="m-auto h-[92vh] w-[96vw] max-w-6xl overflow-hidden rounded-2xl bg-forest-950 p-0 text-cream backdrop:bg-black/80"
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
      >
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span aria-live="polite">Photo {index + 1} of {count}</span>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close gallery" className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-400">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <Image key={images[index].src} src={images[index].src} alt={images[index].alt} fill sizes="96vw" className="object-contain" />
          </div>
          {count > 1 ? (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-400">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-400">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <p className="px-4 py-3 text-center text-xs text-cream/70">{images[index].alt}</p>
        </div>
      </dialog>
    </>
  );
}
