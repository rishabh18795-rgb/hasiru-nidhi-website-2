"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Star, Trash2 } from "lucide-react";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import { deletePropertyImage, makeCoverImage, registerPropertyImage } from "@/app/host/actions";
import { propertyImageUrl } from "@/lib/images";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface ManagedImage { id: string; path: string; source: "storage" | "static"; alt: string | null }

/**
 * Uploads go straight from the browser to Supabase Storage using the host's own session, so the
 * bucket policies (owner-only writes, 5 MB, jpeg/png/webp) are the real enforcement — the checks
 * here are only for fast feedback.
 */
export function PhotoManager({ propertyId, images, editable }: { propertyId: string; images: ManagedImage[]; editable: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createBrowserSupabase();
    if (!supabase) return setError("Photo upload isn't available: storage is not configured.");
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const ext = TYPES[file.type];
        if (!ext) { setError(`“${file.name}” isn't a JPEG, PNG or WebP image.`); continue; }
        if (file.size > MAX_BYTES) { setError(`“${file.name}” is larger than 5 MB.`); continue; }
        const path = `${propertyId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) { setError(`Upload failed for “${file.name}”: ${upErr.message}`); continue; }
        const res = await registerPropertyImage(propertyId, path, file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
        if (!res.ok) setError(res.message ?? "Could not save the photo.");
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {editable ? (
        <>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-forest-900/25 bg-forest-50/50 px-6 py-8 text-center text-sm text-forest-900 hover:bg-forest-50 focus-within:ring-3 focus-within:ring-forest-500/30">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            <span className="font-medium">{busy ? "Uploading…" : "Add photos"}</span>
            <span className="text-xs text-ink/55">JPEG, PNG or WebP · up to 5 MB each · up to 12 photos. Use your own photographs.</span>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
          </label>
          {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        </>
      ) : null}
      {images.length === 0 ? (
        <p className="mt-4 text-sm text-ink/55">No photos yet. At least one is required before you can submit for review.</p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => {
            const url = propertyImageUrl(img.path, img.source);
            return (
              <li key={img.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-forest-900/10">
                <div className="relative aspect-[4/3] bg-forest-50">
                  {url ? <Image src={url} alt={img.alt || "Property photo"} fill sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover" /> : null}
                  {i === 0 ? <span className="absolute left-2 top-2 rounded-full bg-sand-400 px-2 py-0.5 text-xs font-semibold text-forest-950">Cover</span> : null}
                </div>
                {editable ? (
                  <div className="flex items-center justify-between gap-2 p-2">
                    {i !== 0 ? (
                      <button type="button" onClick={() => startTransition(() => makeCoverImage(img.id, propertyId))} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-forest-800 hover:bg-forest-50">
                        <Star className="h-3.5 w-3.5" aria-hidden="true" /> Make cover
                      </button>
                    ) : <span />}
                    <button type="button" onClick={() => startTransition(() => deletePropertyImage(img.id, propertyId))} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-red-700 hover:bg-red-50" aria-label="Delete photo">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
