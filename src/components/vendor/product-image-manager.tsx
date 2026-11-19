"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

import { deleteProductImage, registerProductImage, reorderProductImages } from "@/app/vendor/product-actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { productImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export interface ManagedProductImage { id: string; path: string; alt: string | null }

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 10;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Real photographs only. Uploads go straight to the public bucket with the seller's own session; the first photo is the cover. */
export function ProductImageManager({ vendorId, productId, productName, images, editable }: { vendorId: string; productId: string; productName: string; images: ManagedProductImage[]; editable: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState(productName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createBrowserSupabase();
    if (!supabase) return setError("Photo storage is not configured for this site yet.");
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return setError(`A product can have at most ${MAX_IMAGES} photos.`);
    setBusy(true);
    for (const file of Array.from(files).slice(0, room)) {
      const ext = TYPES[file.type];
      if (!ext) { setError("Upload JPG, PNG or WebP photos."); continue; }
      if (file.size > MAX_BYTES) { setError(`${file.name} is larger than 5 MB.`); continue; }
      const path = `${vendorId}/${productId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { setError(/policy|403|401|not allowed/i.test(upErr.message) ? "You don't have permission to upload photos for this product." : "Upload failed. Please try again."); continue; }
      const res = await registerProductImage(productId, path, alt);
      if (!res.ok) setError(res.message ?? "Could not save the photo.");
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    start(() => router.refresh());
  }

  const move = (i: number, d: number) => {
    const ids = images.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => { const r = await reorderProductImages(productId, ids); if (!r.ok) setError(r.message ?? "Could not reorder."); else router.refresh(); });
  };
  const remove = (id: string) => start(async () => { const r = await deleteProductImage(productId, id); if (!r.ok) setError(r.message ?? "Could not remove it."); else router.refresh(); });

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p> : null}
      {images.length === 0 ? <p className="rounded-xl border border-dashed border-forest-900/20 px-4 py-6 text-center text-sm text-ink/60">No photos yet. Add real photographs of the product itself. At least one is needed to submit.</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className="overflow-hidden rounded-2xl border border-forest-900/10 bg-white">
            <div className="relative aspect-square bg-forest-50">
              <Image src={productImageUrl(img.path) ?? ""} alt={img.alt || productName} fill sizes="(min-width: 1024px) 20vw, 40vw" className="object-cover" unoptimized={!productImageUrl(img.path)} />
              {i === 0 ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-sand-400 px-2 py-0.5 text-[11px] font-semibold text-forest-950"><Star className="h-3 w-3" aria-hidden="true" /> Cover</span> : null}
            </div>
            {editable ? (
              <div className="flex items-center justify-between gap-1 p-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move photo earlier" className={cn("rounded-full p-1.5 hover:bg-forest-50 disabled:opacity-30")}><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move photo later" className="rounded-full p-1.5 hover:bg-forest-50 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(img.id)} aria-label="Remove photo" className="rounded-full p-1.5 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {editable && images.length < MAX_IMAGES ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 text-xs text-ink/70">Describe the photo (for accessibility)
            <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} className="mt-1 h-10 w-full rounded-xl border border-forest-900/15 bg-white px-3 text-sm" />
          </label>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Choose product photos" onChange={(e) => void upload(e.target.files)} />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />} Add photos
          </button>
          <p className="w-full text-xs text-ink/55">JPG, PNG or WebP, up to 5 MB each, up to {MAX_IMAGES} photos. You must own the right to use every photo.</p>
        </div>
      ) : null}
    </div>
  );
}
