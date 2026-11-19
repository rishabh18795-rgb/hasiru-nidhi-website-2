"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { requestCapability } from "@/app/vendor/actions";

export function RequestCapability({ capability }: { capability: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await requestCapability(capability); setMsg(r.ok ? null : r.message ?? "Could not request it."); if (r.ok) router.refresh(); })}
        className="rounded-full border border-forest-900/20 px-4 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50 disabled:opacity-60">
        {pending ? "Requesting…" : "Request"}
      </button>
      {msg ? <span role="alert" className="text-xs text-red-700">{msg}</span> : null}
    </span>
  );
}
