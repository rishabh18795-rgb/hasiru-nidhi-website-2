"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

import { deleteVendorDocument, registerVendorDocument } from "@/app/vendor/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { DOC_TYPES, MAX_DOC_BYTES } from "@/lib/validation/vendor";
import type { DocumentStatus } from "@/lib/db/types";
import { StatusBadge } from "@/components/app/ui";

export interface DocRow { id: string; label: string; status: DocumentStatus; reviewer_note: string | null; original_name: string | null }

/** Uploads straight to the private bucket with the vendor's own session (storage policies are the real gate), then records the file. */
export function DocumentSlot({ vendorId, requirementId, label, hint, required, docs, disabled }: {
  vendorId: string; requirementId: number | null; label: string; hint?: string | null; required?: boolean; docs: DocRow[]; disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const ext = DOC_TYPES[file.type];
    if (!ext) return setError("Upload a JPG, PNG, WebP or PDF file.");
    if (file.size > MAX_DOC_BYTES) return setError("That file is larger than 10 MB.");
    const supabase = createBrowserSupabase();
    if (!supabase) return setError("File storage is not configured for this site yet.");
    setBusy(true);
    const path = `${vendorId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vendor-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setError(/policy|not allowed|403|401/i.test(upErr.message) ? "You don't have permission to upload documents." : "Upload failed. Please try again.");
    }
    const res = await registerVendorDocument(requirementId, label, path, file.name);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) return setError(res.message ?? "Could not save the document.");
    startTransition(() => router.refresh());
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteVendorDocument(id);
      if (!res.ok) setError(res.message ?? "Could not remove it.");
      else router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-forest-900/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-forest-950">{label}{required ? <span className="ml-2 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-semibold text-earth-700">Required</span> : null}</p>
          {hint ? <p className="mt-0.5 text-xs text-ink/65">{hint}</p> : null}
        </div>
        {!disabled ? (
          <>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" id={`doc-${requirementId ?? "other"}`} aria-label={`Choose a file for ${label}`} onChange={(e) => void onFile(e.target.files?.[0])} />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-full border border-forest-900/20 px-4 text-sm font-medium text-forest-900 hover:bg-forest-50 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {docs.length ? "Add another" : "Upload"}
            </button>
          </>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
      {docs.length ? (
        <ul className="mt-3 divide-y divide-forest-900/8">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="flex items-center gap-2 text-ink/80"><FileText className="h-4 w-4 text-forest-700" aria-hidden="true" />{d.original_name ?? d.label}</span>
              <span className="flex items-center gap-3">
                <StatusBadge status={d.status === "accepted" ? "approved" : d.status === "rejected" ? "rejected" : "pending_review"} />
                {d.status !== "accepted" && !disabled ? (
                  <button type="button" onClick={() => remove(d.id)} aria-label={`Remove ${d.original_name ?? d.label}`} className="text-ink/65 hover:text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                ) : null}
              </span>
              {d.reviewer_note ? <p className="w-full text-xs text-ink/65">Reviewer note: {d.reviewer_note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
