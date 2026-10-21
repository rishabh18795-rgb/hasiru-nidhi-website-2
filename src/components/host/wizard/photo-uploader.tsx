"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, ImagePlus, Loader2, RotateCcw, Star, Trash2, X } from "lucide-react";

import { deletePropertyImage, makeCoverImage, registerPropertyImage, reorderPropertyImages } from "@/app/host/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { propertyImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export interface ManagedImage { id: string; path: string; source: "storage" | "static"; alt: string | null }

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 20;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

interface Upload {
  key: string;
  file: File;
  preview: string;
  progress: number;
  status: "uploading" | "saving" | "error";
  error?: string;
  path: string;
}

/** POSTs the file straight to Supabase Storage with the host's own session (so bucket policies are the real gate) and reports progress. */
function sendToStorage(url: string, token: string, anonKey: string, path: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${url.replace(/\/+$/, "")}/storage/v1/object/property-images/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let reason = "";
      try { reason = (JSON.parse(xhr.responseText) as { message?: string }).message ?? ""; } catch { /* not JSON */ }
      reject(new Error(xhr.status === 401 || xhr.status === 403 ? "You don't have permission to upload to this listing." : reason || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and retry."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

export function PhotoUploader({ propertyId, images, editable }: { propertyId: string; images: ManagedImage[]; editable: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [order, setOrder] = useState(images);
  const sig = images.map((i) => i.id).join(",");
  const [seenSig, setSeenSig] = useState(sig);
  // Server data changed (after a refresh): adopt it. Done during render, which is React's recommended way to derive state from props.
  if (sig !== seenSig) {
    setSeenSig(sig);
    setOrder(images);
  }
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const patch = (key: string, p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const drop = (key: string) => setUploads((u) => {
    const gone = u.find((x) => x.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    return u.filter((x) => x.key !== key);
  });

  async function run(up: Upload) {
    const supabase = createBrowserSupabase();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (!supabase || !url || !anon) return patch(up.key, { status: "error", error: "Photo storage is not configured for this site yet." });
    try {
      patch(up.key, { status: "uploading", progress: 0, error: undefined });
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      await sendToStorage(url, token, anon, up.path, up.file, (progress) => patch(up.key, { progress }));
      patch(up.key, { status: "saving", progress: 100 });
      const res = await registerPropertyImage(propertyId, up.path, up.file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
      if (!res.ok) throw new Error(res.message ?? "Could not save the photograph.");
      drop(up.key);
      router.refresh();
    } catch (err) {
      patch(up.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed." });
    }
  }

  function addFiles(list: FileList | File[]) {
    setMessage(null);
    const files = Array.from(list);
    const room = MAX_PHOTOS - order.length - uploads.filter((u) => u.status !== "error").length;
    const problems: string[] = [];
    const accepted: Upload[] = [];
    for (const file of files) {
      const ext = TYPES[file.type];
      if (!ext) { problems.push(`“${file.name}” isn't a JPEG, PNG or WebP image.`); continue; }
      if (file.size > MAX_BYTES) { problems.push(`“${file.name}” is larger than 5 MB.`); continue; }
      if (accepted.length >= room) { problems.push(`A listing can have at most ${MAX_PHOTOS} photographs; “${file.name}” was not added.`); continue; }
      accepted.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), progress: 0, status: "uploading", path: `${propertyId}/${crypto.randomUUID()}.${ext}` });
    }
    if (problems.length) setMessage(problems.join(" "));
    if (!accepted.length) return;
    setUploads((u) => [...u, ...accepted]);
    accepted.forEach((a) => void run(a));
  }

  function persistOrder(next: ManagedImage[], previous: ManagedImage[]) {
    setOrder(next);
    startTransition(async () => {
      const res = await reorderPropertyImages(propertyId, next.map((i) => i.id));
      if (!res.ok) { setOrder(previous); setMessage(res.message ?? "Couldn't save the new order."); } else router.refresh();
    });
  }
  function move(id: string, delta: number) {
    const i = order.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    persistOrder(next, order);
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = order.findIndex((x) => x.id === dragId);
    const to = order.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persistOrder(next, order);
  }
  function remove(img: ManagedImage) {
    setOrder(order.filter((x) => x.id !== img.id));
    startTransition(async () => { await deletePropertyImage(img.id, propertyId); router.refresh(); });
  }
  function cover(img: ManagedImage) {
    const next = [img, ...order.filter((x) => x.id !== img.id)];
    setOrder(next);
    startTransition(async () => {
      const res = await makeCoverImage(img.id, propertyId);
      if (!res.ok) setMessage(res.message ?? "Couldn't change the cover photo.");
      router.refresh();
    });
  }

  const btn = "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-forest-800 hover:bg-forest-50 disabled:opacity-40";
  return (
    <div className="space-y-5">
      {editable ? (
        <div
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); } }}
          className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center text-sm transition-colors",
            dragOver ? "border-forest-700 bg-forest-100" : "border-forest-900/25 bg-forest-50/50")}
        >
          <ImagePlus className="h-7 w-7 text-forest-700" aria-hidden="true" />
          <p className="font-medium text-forest-950">Drag photographs here, or</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 font-medium text-cream hover:bg-forest-700">Browse files</button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Choose photographs to upload"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <p className="text-xs text-ink/60">JPEG, PNG or WebP · up to 5 MB each · up to {MAX_PHOTOS} photographs. We recommend at least 5, taken by you, showing the real property.</p>
        </div>
      ) : null}

      {message ? <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{message}</p> : null}

      {uploads.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Uploads in progress">
          {uploads.map((u) => (
            <li key={u.key} className="overflow-hidden rounded-xl bg-white ring-1 ring-forest-900/10">
              <div className="relative aspect-[4/3] bg-forest-50">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset */}
                <img src={u.preview} alt="" className={cn("h-full w-full object-cover", u.status !== "error" && "opacity-60")} />
                {u.status !== "error" ? <Loader2 className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-forest-800" aria-hidden="true" /> : null}
              </div>
              <div className="p-3 text-xs">
                <p className="truncate font-medium text-forest-950">{u.file.name}</p>
                {u.status === "error" ? (
                  <>
                    <p role="alert" className="mt-1 text-red-700">{u.error}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void run(u)} className={btn}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry</button>
                      <button type="button" onClick={() => drop(u.key)} className={cn(btn, "text-red-700 hover:bg-red-50")}><X className="h-3.5 w-3.5" aria-hidden="true" /> Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-forest-900/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={u.progress} aria-label={`Uploading ${u.file.name}`}>
                      <div className="h-full bg-forest-600 transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                    <p className="mt-1 text-ink/60">{u.status === "saving" ? "Saving…" : `Uploading… ${u.progress}%`}</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {order.length === 0 && uploads.length === 0 ? (
        <p className="text-sm text-ink/60">No photographs yet. At least one is required before you can submit your listing.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Saved photographs">
          {order.map((img, i) => {
            const url = propertyImageUrl(img.path, img.source);
            return (
              <li key={img.id} draggable={editable} onDragStart={() => setDragId(img.id)} onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={() => dropOn(img.id)} onDragEnd={() => setDragId(null)}
                className={cn("overflow-hidden rounded-xl bg-white ring-1 ring-forest-900/10", dragId === img.id && "opacity-50")}>
                <div className="relative aspect-[4/3] bg-forest-50">
                  {url ? <Image src={url} alt={img.alt || "Property photograph"} fill sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 100vw" className="object-cover" /> : null}
                  {i === 0 ? <span className="absolute left-2 top-2 rounded-full bg-sand-400 px-2.5 py-0.5 text-xs font-semibold text-forest-950">Cover photo</span> : null}
                </div>
                {editable ? (
                  <div className="flex flex-wrap items-center justify-between gap-1 p-2">
                    <div className="flex items-center">
                      <button type="button" onClick={() => move(img.id, -1)} disabled={i === 0} className={btn} aria-label={`Move photograph ${i + 1} earlier`}><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      <button type="button" onClick={() => move(img.id, 1)} disabled={i === order.length - 1} className={btn} aria-label={`Move photograph ${i + 1} later`}><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      {i !== 0 ? <button type="button" onClick={() => cover(img)} className={btn}><Star className="h-3.5 w-3.5" aria-hidden="true" /> Cover</button> : null}
                    </div>
                    <button type="button" onClick={() => remove(img)} className={cn(btn, "text-red-700 hover:bg-red-50")} aria-label={`Delete photograph ${i + 1}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {order.length > 1 && editable ? <p className="text-xs text-ink/55">Drag photographs to reorder them, or use the arrows. The first photograph is the cover.</p> : null}
    </div>
  );
}
