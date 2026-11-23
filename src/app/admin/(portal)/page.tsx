import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";

import { Card, CardTitle, Stat } from "@/components/app/ui";
import { requireRole } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { formatDateTime, formatINR } from "@/lib/format";
import { getPublicSettings } from "@/lib/data/catalog";

function tally<T>(rows: T[] | null, key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? []) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

export default async function AdminOverview() {
  const { supabase } = await requireRole(["admin"], "/admin");
  const [profiles, props, bookings, enq, gard, apps, reps, audit, settings, ledger, owing, settling] = await Promise.all([
    supabase.from("profiles").select("role").limit(10000),
    supabase.from("properties").select("status").limit(10000),
    supabase.from("bookings").select("status").limit(10000),
    supabase.from("contact_enquiries").select("status").limit(10000),
    supabase.from("gardening_enquiries").select("status").limit(10000),
    supabase.from("partner_applications").select("status").limit(10000),
    supabase.from("reports").select("status").limit(10000),
    supabase.from("audit_logs").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(8),
    getPublicSettings(),
    supabase.from("commission_ledger").select("commission_inr, host_share_inr").limit(10000),
    supabase.from("booking_financials").select("booking_id", { count: "exact", head: true }).in("status", ["confirmed", "completed"]).in("payment_status", ["unpaid", "initiated", "failed"]),
    supabase.from("host_settlements").select("amount_inr").in("status", ["pending", "processing", "on_hold"]).limit(1000),
  ]);
  const roles = tally(profiles.data, (r) => r.role as string);
  const ps = tally(props.data, (r) => r.status as string);
  const bs = tally(bookings.data, (r) => r.status as string);
  const newContact = tally(enq.data, (r) => r.status as string).new ?? 0;
  const newGardening = tally(gard.data, (r) => r.status as string).new ?? 0;
  const sumOf = (rows: Record<string, unknown>[] | null, key: string) => (rows ?? []).reduce((t, r) => t + Number(r[key] ?? 0), 0);
  const newApps = tally(apps.data, (r) => r.status as string).new ?? 0;
  const openReports = tally(reps.data, (r) => r.status as string).open ?? 0;

  const setup = [
    { ok: isServiceRoleConfigured(), label: "Supabase service-role key", help: "Needed for private enquiry photos and e-mail recipient lookup (SUPABASE_SERVICE_ROLE_KEY)." },
    { ok: isEmailConfigured(), label: "Transactional e-mail provider", help: "Set RESEND_API_KEY and EMAIL_FROM. Until then e-mail notifications are skipped (in-app notifications still work)." },
    { ok: Boolean(process.env.ADMIN_NOTIFY_EMAIL), label: "Admin notification e-mail", help: "Set ADMIN_NOTIFY_EMAIL to be e-mailed about new enquiries and listings." },
    { ok: Boolean(settings.whatsapp_number), label: "WhatsApp business number", help: "Add the official number in Settings. WhatsApp buttons stay hidden until then." },
    { ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL), label: "Public site URL", help: "Set NEXT_PUBLIC_SITE_URL to your production domain for canonical URLs and sitemap." },
    { ok: false, label: "Online payments", help: "Not enabled. Bookings are requests settled directly between guest and host; a payment provider (e.g. Razorpay) needs business credentials before it can be added." },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Administration</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registered customers" value={roles.traveller ?? 0} />
        <Stat label="Hosts" value={roles.host ?? 0} hint={`${roles.admin ?? 0} administrator${(roles.admin ?? 0) === 1 ? "" : "s"}`} />
        <Stat label="Total properties" value={Object.values(ps).reduce((a, b) => a + b, 0)} />
        <Stat label="Awaiting approval" value={ps.pending_review ?? 0} hint="Review queue: Listings" />
        <Stat label="Published properties" value={ps.approved ?? 0} />
        <Stat label="Rejected or suspended" value={(ps.rejected ?? 0) + (ps.suspended ?? 0)} hint={`${ps.rejected ?? 0} rejected / returned · ${ps.suspended ?? 0} suspended`} />
        <Stat label="Pending booking requests" value={bs.requested ?? 0} />
        <Stat label="Confirmed bookings" value={bs.confirmed ?? 0} hint={`${bs.completed ?? 0} completed`} />
        <Stat label="New enquiries" value={newContact} hint="Contact and booking-experience forms" />
        <Stat label="New gardening enquiries" value={newGardening} hint="Separate queue: /admin/gardening" />
        <Stat label="New partner applications" value={newApps} />
        <Stat label="Open reports" value={openReports} />
      </div>
      <section aria-label="Money" className="rounded-3xl bg-gradient-to-br from-forest-950 via-forest-900 to-forest-700 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total bookings", String(Object.values(bs).reduce((x, y) => x + y, 0)), "All statuses"],
            ["Host earnings (net share)", formatINR(sumOf(ledger.data as Record<string, unknown>[] | null, "host_share_inr")), "80% share on confirmed bookings, after reversals"],
            ["Platform commission (net)", formatINR(sumOf(ledger.data as Record<string, unknown>[] | null, "commission_inr")), "From confirmed bookings, after reversals"],
            ["Bookings without a recorded payment", String(owing.count ?? 0), "Online payment is not enabled; record payments in Admin → Payments"],
            ["Settlements in progress", formatINR(sumOf(settling.data as Record<string, unknown>[] | null, "amount_inr")), "Pending, processing or on hold"],
          ].map(([label, value, hint]) => (
            <div key={label} className="glass-dark rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-cream/70">{label}</p>
              <p className="mt-1 font-display text-2xl">{value}</p>
              <p className="mt-1 text-xs leading-snug text-cream/70">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <Card>
        <CardTitle>Setup status</CardTitle>
        <ul className="space-y-3">
          {setup.map((s) => (
            <li key={s.label} className="flex gap-3 text-sm">
              {s.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" aria-label="Configured" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Action required" />}
              <div><p className="font-medium text-forest-950">{s.label}</p>{s.ok ? null : <p className="text-ink/65">{s.help}</p>}</div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink/65">Items marked with a warning are pending setup — the related feature is skipped or hidden, never faked.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle aside={<Link href="/admin/properties" className="text-sm text-forest-700 underline">Review queue</Link>}>Listings by status</CardTitle>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(ps).map(([k, v]) => <li key={k} className="flex justify-between capitalize"><span>{k.replace("_", " ")}</span><strong>{v}</strong></li>)}
            {Object.keys(ps).length === 0 ? <li className="text-ink/65">No listings yet.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardTitle>Recent admin activity</CardTitle>
          {(audit.data ?? []).length === 0 ? <p className="text-sm text-ink/65">No admin actions recorded yet.</p> : (
            <ul className="space-y-2 text-sm">
              {(audit.data ?? []).map((a) => <li key={a.id as number} className="flex justify-between gap-3"><span>{(a.action as string).replace("_", " ")} · {a.entity_type as string}</span><time className="text-xs text-ink/65">{formatDateTime(a.created_at as string)}</time></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
