"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { serviceLifecycle, setServiceAvailable } from "@/app/vendor/service-actions";
import type { ServiceStatus } from "@/lib/db/types";

/** Submit, archive, restore and pause. Every button does something real or is not shown. */
export function ServiceLifecycle({ serviceId, status, isAvailable }: { serviceId: string; status: ServiceStatus; isAvailable: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg({ ok: Boolean(r.ok), text: r.message ?? (r.ok ? "Done." : "Something went wrong.") }); if (r.ok) router.refresh(); });
  const btn = "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium disabled:opacity-60";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {status === "draft" || status === "rejected" ? <button type="button" disabled={pending} onClick={() => run(() => serviceLifecycle(serviceId, "submit_service"))} className={`${btn} bg-forest-800 text-cream hover:bg-forest-700`}>Submit for review</button> : null}
        {status === "approved" ? <button type="button" disabled={pending} onClick={() => run(() => setServiceAvailable(serviceId, !isAvailable))} className={`${btn} border border-forest-900/20 bg-white text-forest-900 hover:bg-forest-50`}>{isAvailable ? "Pause new requests" : "Accept requests again"}</button> : null}
        {["draft", "rejected", "approved", "pending_review"].includes(status) ? <button type="button" disabled={pending} onClick={() => { if (window.confirm("Archive this service? It will be hidden from customers.")) run(() => serviceLifecycle(serviceId, "archive_service")); }} className={`${btn} border border-forest-900/20 bg-white text-ink/70 hover:bg-forest-50`}>Archive</button> : null}
        {status === "archived" ? <button type="button" disabled={pending} onClick={() => run(() => serviceLifecycle(serviceId, "restore_service"))} className={`${btn} bg-forest-800 text-cream hover:bg-forest-700`}>Restore as draft</button> : null}
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-forest-800" : "text-red-700"}`}>{msg.text}</p> : null}
    </div>
  );
}
