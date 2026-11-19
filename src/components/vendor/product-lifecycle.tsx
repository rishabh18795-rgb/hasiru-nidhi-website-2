"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { productLifecycle, setProductAvailability } from "@/app/vendor/product-actions";
import type { ProductStatus } from "@/lib/db/types";

/** Submit, archive, restore and pause. Every button does something real or is not shown. */
export function ProductLifecycle({ productId, status, isAvailable }: { productId: string; status: ProductStatus; isAvailable: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg({ ok: Boolean(r.ok), text: r.message ?? (r.ok ? "Done." : "Something went wrong.") }); if (r.ok) router.refresh(); });
  const btn = "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium disabled:opacity-60";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {status === "draft" || status === "rejected" ? <button type="button" disabled={pending} onClick={() => run(() => productLifecycle(productId, "submit_product"))} className={`${btn} bg-forest-800 text-cream hover:bg-forest-700`}>Submit for review</button> : null}
        {status === "approved" ? <button type="button" disabled={pending} onClick={() => run(() => setProductAvailability(productId, !isAvailable))} className={`${btn} border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50`}>{isAvailable ? "Pause selling" : "Resume selling"}</button> : null}
        {["draft", "rejected", "approved", "pending_review"].includes(status) ? <button type="button" disabled={pending} onClick={() => { if (window.confirm("Archive this product? It will be hidden from shoppers.")) run(() => productLifecycle(productId, "archive_product")); }} className={`${btn} border border-forest-900/20 bg-white text-ink/70 hover:bg-forest-50`}>Archive</button> : null}
        {status === "archived" ? <button type="button" disabled={pending} onClick={() => run(() => productLifecycle(productId, "restore_product"))} className={`${btn} bg-forest-800 text-cream hover:bg-forest-700`}>Restore as draft</button> : null}
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-forest-800" : "text-red-700"}`}>{msg.text}</p> : null}
    </div>
  );
}
