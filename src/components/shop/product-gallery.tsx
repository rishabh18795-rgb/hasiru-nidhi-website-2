"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

/** Main photograph with a thumbnail strip. Works with one photo or ten; thumbnails are real buttons. */
export function ProductGallery({ images, name }: { images: { src: string; alt: string }[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, images.length - 1)];
  return (
    <div className="space-y-3" role="group" aria-label={`${name} photographs`}>
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-forest-50 ring-1 ring-forest-900/10">
        <Image key={current.src} src={current.src} alt={current.alt} fill priority sizes="(min-width: 1024px) 50vw, 92vw" className="object-cover" />
        {images.length > 1 ? <span className="glass pointer-events-none absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-medium text-forest-950" aria-live="polite">{index + 1} / {images.length}</span> : null}
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <li key={img.src} className="shrink-0">
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1} of ${images.length}`} aria-pressed={i === index}
                className={cn("relative block h-16 w-16 overflow-hidden rounded-xl bg-forest-50 ring-2 transition sm:h-20 sm:w-20", i === index ? "ring-forest-700" : "ring-transparent hover:ring-forest-300")}>
                <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
