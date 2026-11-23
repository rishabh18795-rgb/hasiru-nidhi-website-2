import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { ServicesGate } from "@/components/vendor/capability-gate";
import { ServiceForm } from "@/components/vendor/service-form";
import { ServiceImageManager } from "@/components/vendor/service-image-manager";
import { ServiceLifecycle } from "@/components/vendor/service-lifecycle";
import { requireUser } from "@/lib/auth";
import { getServiceCategories } from "@/lib/data/services";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { SERVICE_STATUS_COPY } from "@/lib/services";
import type { Service, ServiceImage } from "@/lib/db/types";

export const metadata: Metadata = { title: "Edit service" };

export default async function VendorServiceEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/vendor/services/${id}`);
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "services")) return <ServicesGate ctx={ctx} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: s } = await supabase.from("services").select("*").eq("id", id).eq("vendor_id", ctx.vendor!.id).maybeSingle();
  if (!s) notFound();
  const service = s as Service;
  const [categories, { data: im }, { count: areas }] = await Promise.all([
    getServiceCategories(),
    supabase.from("service_images").select("*").eq("service_id", id).order("sort_order"),
    supabase.from("vendor_service_areas").select("id", { count: "exact", head: true }).eq("vendor_id", ctx.vendor!.id).eq("scope", "service"),
  ]);
  const images = (im ?? []) as ServiceImage[];
  const editable = ["draft", "rejected", "approved"].includes(service.status);
  const missing = [
    images.length === 0 && "at least one photo",
    service.description.trim().length < 30 && "a description of at least 30 characters",
    (areas ?? 0) === 0 && "your service PIN codes (Delivery & service areas)",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vendor/services" className="text-sm text-forest-700 underline">← All services</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-medium tracking-tight text-forest-950">{service.name}</h1><StatusBadge status={service.status} /></div>
        <p className="mt-1 text-sm text-ink/65">{SERVICE_STATUS_COPY[service.status]}</p>
      </div>
      {service.rejection_reason && ["draft", "rejected", "suspended"].includes(service.status) ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Note from our team: {service.rejection_reason}</p> : null}

      <Card>
        <CardTitle>Review and visibility</CardTitle>
        {["draft", "rejected"].includes(service.status) && missing.length ? <p className="mb-3 text-sm text-ink/70">Before you can submit, add: {missing.join("; ")}. {(areas ?? 0) === 0 ? <Link href="/vendor/coverage" className="underline">Set service areas</Link> : null}</p> : null}
        <ServiceLifecycle serviceId={service.id} status={service.status} isAvailable={service.is_available} />
      </Card>

      <Card><CardTitle>Details and pricing</CardTitle><ServiceForm service={service} categories={categories} locked={!editable} /></Card>
      <Card><CardTitle>Photos</CardTitle><ServiceImageManager vendorId={ctx.vendor!.id} serviceId={service.id} serviceName={service.name} images={images.map((i) => ({ id: i.id, path: i.path, alt: i.alt }))} editable={editable} /></Card>
    </div>
  );
}
