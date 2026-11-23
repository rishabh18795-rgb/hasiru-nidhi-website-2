import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Card, DefinitionList, EmptyState, Stat, StatusBadge } from "@/components/app/ui";
import { UserActions } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { formatDate, formatINR } from "@/lib/format";
import type { BookingFinancial, HostSettlement, Profile } from "@/lib/db/types";

export const metadata: Metadata = { title: "Host" };

export default async function AdminHostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireRole(["admin"], `/admin/hosts/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ data: profile }, { data: properties }, { data: money }, { data: settlements }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("properties").select("id, name, status, city, postal_code").eq("host_id", id).order("created_at", { ascending: false }),
    supabase.from("booking_financials").select("*").eq("host_id", id).order("check_in", { ascending: false }).limit(200),
    supabase.from("host_settlements").select("*").eq("host_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  const host = profile as Profile | null;
  if (!host || host.role !== "host") notFound();
  const bookings = (money ?? []) as BookingFinancial[];
  const props = (properties ?? []) as { id: string; name: string; status: string; city: string | null; postal_code: string | null }[];
  const sets = (settlements ?? []) as HostSettlement[];
  const sum = (f: (b: BookingFinancial) => number) => bookings.reduce((t, b) => t + f(b), 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/hosts" className="text-sm text-forest-700 underline underline-offset-2">← All hosts</Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-forest-950">{host.full_name || "(no name)"}</h1>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-medium text-forest-950">Host verification</h2>
        <DefinitionList items={[
          { label: "Email", value: host.email },
          { label: "Phone", value: host.phone },
          { label: "Joined", value: formatDate(host.created_at) },
          { label: "Verification", value: host.host_verified ? "Verified host" : "Not verified" },
          { label: "Account", value: host.is_suspended ? "Suspended" : "Active" },
        ]} />
        {host.id !== user.id ? <UserActions userId={host.id} role={host.role} suspended={host.is_suspended} verified={host.host_verified} /> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Bookings" value={bookings.length} />
        <Stat label="Platform commission (net)" value={formatINR(sum((b) => Number(b.net_commission_inr)))} />
        <Stat label="Host share (net)" value={formatINR(sum((b) => Number(b.net_host_share_inr)))} />
      </div>

      <section aria-labelledby="props-h" className="space-y-3">
        <h2 id="props-h" className="text-lg font-medium text-forest-950">Properties</h2>
        {props.length === 0 ? <EmptyState title="No properties yet" /> : (
          <ul className="space-y-2">
            {props.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <Link href={`/admin/properties/${p.id}`} className="font-medium text-forest-950 underline-offset-2 hover:underline">{p.name}</Link>
                  <span className="flex items-center gap-3 text-sm text-ink/65">{[p.city, p.postal_code && `PIN ${p.postal_code}`].filter(Boolean).join(" · ")} <StatusBadge status={p.status} /></span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="set-h" className="space-y-3">
        <h2 id="set-h" className="text-lg font-medium text-forest-950">Settlements</h2>
        {sets.length === 0 ? <EmptyState title="No settlements yet" /> : (
          <ul className="space-y-2">
            {sets.map((s) => <li key={s.id}><Card className="flex flex-wrap items-center justify-between gap-2 p-4"><span>{formatINR(s.amount_inr)} · {formatDate(s.created_at)}</span><span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs capitalize text-forest-800">{s.status.replace("_", " ")}</span></Card></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
