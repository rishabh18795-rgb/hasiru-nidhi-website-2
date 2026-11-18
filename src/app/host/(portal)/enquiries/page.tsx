import type { Metadata } from "next";

import { Card, CardTitle, EmptyState } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Enquiries" };

export default async function HostEnquiries() {
  const { supabase, user } = await requireRole(["host"], "/host/enquiries");
  const [{ data: enquiries }, { data: apps }] = await Promise.all([
    // RLS (contact_host_select) returns only enquiries made about this host's own listings.
    supabase.from("contact_enquiries").select("id, name, email, phone, subject, message, created_at, properties(name)").not("property_id", "is", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("partner_applications").select("id, property_name, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  type Enq = { id: string; name: string; email: string | null; phone: string | null; subject: string | null; message: string; created_at: string; properties: { name: string } | null };
  const list = (enquiries ?? []) as unknown as Enq[];
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Enquiries</h1>
      {list.length === 0 ? (
        <EmptyState title="No enquiries yet" description="Questions sent from your listing pages will appear here. Reply to the guest using the contact details they provided." />
      ) : (
        <ul className="space-y-4">
          {list.map((q) => (
            <li key={q.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-medium text-forest-950">{q.name}</p><p className="text-sm text-ink/60">About: {q.properties?.name ?? "your listing"}</p></div>
                  <time className="text-xs text-ink/45" dateTime={q.created_at}>{formatDateTime(q.created_at)}</time>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-ink/80">{q.message}</p>
                <p className="mt-3 text-sm text-forest-800">{[q.email, q.phone].filter(Boolean).join(" · ")}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardTitle>Your partnership applications</CardTitle>
        {(apps ?? []).length === 0 ? <p className="text-sm text-ink/55">You haven&apos;t submitted a partnership application from this account.</p> : (
          <ul className="divide-y divide-forest-900/8 text-sm">
            {(apps ?? []).map((a) => <li key={a.id as string} className="flex justify-between py-2.5"><span>{a.property_name as string}</span><span className="capitalize text-ink/60">{a.status as string} · {formatDateTime(a.created_at as string)}</span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
