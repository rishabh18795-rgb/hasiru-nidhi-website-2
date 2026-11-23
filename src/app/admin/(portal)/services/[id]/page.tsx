import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, DefinitionList, StatusBadge } from "@/components/app/ui";
import { ServiceDecisionForm } from "@/components/admin/service-forms";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { serviceImageUrl } from "@/lib/images";
import { PRICING_LABEL, durationText, servicePriceText } from "@/lib/services";
import { setServiceFeatured } from "@/app/admin/service-actions";
import type { Service, ServiceImage } from "@/lib/db/types";

export const metadata: Metadata = { title: "Service" };

type Joined = Service & { vendors: { id: string; business_name: string; status: string; city: string | null; state: string | null; contact_email: string | null; contact_phone: string | null } | null; service_categories: { name: string; slug: string } | null };

export default async function AdminServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireRole(["admin"], `/admin/services/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: s } = await supabase.from("services").select("*, vendors(id, business_name, status, city, state, contact_email, contact_phone), service_categories(name, slug)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const service = s as unknown as Joined;
  const [{ data: im }, { data: caps }, { count: areas }, { count: requests }] = await Promise.all([
    supabase.from("service_images").select("*").eq("service_id", id).order("sort_order"),
    supabase.from("vendor_capabilities").select("capability, status").eq("vendor_id", service.vendor_id),
    supabase.from("vendor_service_areas").select("id", { count: "exact", head: true }).eq("vendor_id", service.vendor_id).eq("scope", "service"),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("service_id", id),
  ]);
  const images = (im ?? []) as ServiceImage[];
  const servicesCap = (caps ?? []).find((c) => c.capability === "services")?.status as string | undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/services" className="text-sm text-forest-700 underline">← All services</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{service.name}</h1><StatusBadge status={service.status} />{service.is_featured ? <span className="text-xs text-ink/60">featured</span> : null}</div>
        <p className="mt-1 text-sm text-ink/60">Submitted {service.submitted_at ? formatDateTime(service.submitted_at) : "—"} · /services/{service.slug}</p>
      </div>

      <Card>
        <CardTitle>Provider</CardTitle>
        <DefinitionList items={[
          { label: "Business", value: service.vendors ? <Link href={`/admin/vendors/${service.vendors.id}`} className="underline">{service.vendors.business_name}</Link> : null },
          { label: "Business status", value: service.vendors?.status },
          { label: "Services capability", value: servicesCap },
          { label: "Location", value: [service.vendors?.city, service.vendors?.state].filter(Boolean).join(", ") },
          { label: "Contact", value: [service.vendors?.contact_phone, service.vendors?.contact_email].filter(Boolean).join(" · ") },
          { label: "Service PIN coverage", value: (areas ?? 0) > 0 ? `${areas} entries listed` : "None listed: nobody could request this service" },
          { label: "Requests received", value: String(requests ?? 0) },
        ]} />
      </Card>

      <Card>
        <CardTitle>Decision</CardTitle>
        <ServiceDecisionForm serviceId={service.id} status={service.status} />
        {service.rejection_reason ? <p className="mt-3 text-sm text-ink/60">Last note recorded: {service.rejection_reason}</p> : null}
        {service.status === "approved" ? (
          <form action={setServiceFeatured.bind(null, service.id, !service.is_featured)} className="mt-4"><button type="submit" className="h-9 rounded-full border border-forest-900/20 px-4 text-sm font-medium text-forest-900 hover:bg-forest-50">{service.is_featured ? "Remove from featured" : "Feature this service"}</button></form>
        ) : null}
      </Card>

      <Card>
        <CardTitle>What the provider submitted</CardTitle>
        <DefinitionList items={[
          { label: "Category", value: service.service_categories?.name },
          { label: "Pricing", value: `${PRICING_LABEL[service.pricing_model]}: ${servicePriceText(service.pricing_model, service.price_inr, service.price_unit)}` },
          { label: "Visit length", value: durationText(service.duration_minutes) },
          { label: "Summary", value: service.summary },
          { label: "Availability", value: service.is_available ? "Accepting requests" : "Paused by the provider" },
        ]} />
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/80">{service.description || <span className="text-ink/40">No description.</span>}</p>
        {service.attributes.length ? <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{service.attributes.map((a) => <div key={a.label}><dt className="text-xs uppercase tracking-wide text-ink/50">{a.label}</dt><dd>{a.value}</dd></div>)}</dl> : null}
      </Card>

      <Card>
        <CardTitle>Photos</CardTitle>
        {images.length === 0 ? <p className="text-sm text-ink/60">No photos.</p> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((i) => <li key={i.id} className="relative aspect-square overflow-hidden rounded-xl bg-forest-50"><Image src={serviceImageUrl(i.path) ?? ""} alt={i.alt || service.name} fill sizes="20vw" className="object-cover" unoptimized={!serviceImageUrl(i.path)} /></li>)}</ul>
        )}
      </Card>
    </div>
  );
}
