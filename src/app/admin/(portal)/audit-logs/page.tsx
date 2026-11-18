import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

interface Row {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTIONS_PER_PAGE = 100;

export default async function AdminAuditLogs() {
  const { supabase } = await requireRole(["admin"], "/admin/audit-logs");
  const { data } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(ACTIONS_PER_PAGE);
  const rows = (data ?? []) as Row[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id as string, (a.full_name as string) || (a.email as string) || "Administrator"]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Audit log</h1>
        <p className="mt-1 text-sm text-ink/60">
          A tamper-resistant record of sensitive administrator actions: listing decisions, account changes, review moderation, catalogue and settings changes. Entries cannot be edited or deleted through the app. Showing the latest {ACTIONS_PER_PAGE}.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nothing recorded yet" description="Administrator actions will be listed here as they happen." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70"><time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time></td>
                  <td className="px-4 py-3">{r.actor_id ? names.get(r.actor_id) ?? "Unknown user" : "System"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-forest-900">{r.action}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {r.entity_type}
                    {r.entity_id ? <span className="block break-all font-mono text-[11px] text-ink/45">{r.entity_id}</span> : null}
                  </td>
                  <td className="px-4 py-3 break-words text-xs text-ink/65">
                    {r.details && Object.keys(r.details).length ? JSON.stringify(r.details) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
