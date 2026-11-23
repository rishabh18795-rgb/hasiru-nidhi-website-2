import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Card, EmptyState, StatusBadge } from "@/components/app/ui";
import { ServicesGate } from "@/components/vendor/capability-gate";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { formatDate } from "@/lib/format";
import { serviceImageUrl } from "@/lib/images";
import { servicePriceText } from "@/lib/services";
import type { ServicePricingModel } from "@/lib/db/types";

export const metadata: Metadata = { title: "Services" };

interface Row {
  id: string; name: string; status: string; updated_at: string; is_available: boolean; pricing_model: ServicePricingModel; price_inr: number | string | null; price_unit: string | null;
  service_categories: { name: string } | null; service_images: { path: string; sort_order: number }[];
}

export default async function VendorServicesPage() {
  const { supabase, user } = await requireUser("/vendor/services");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "services")) return <ServicesGate ctx={ctx} />;
  const { data } = await supabase.from("services")
    .select("id, name, status, updated_at, is_available, pricing_model, price_inr, price_unit, service_categories(name), service_images(path, sort_order)")
    .eq("vendor_id", ctx.vendor!.id).order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-forest-950">Services</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/65">Create service listings, add photos, then submit them for review. Nothing is public until our team approves the listing and Services is open. Remember to set your <Link href="/vendor/coverage" className="underline">service areas</Link> and <Link href="/vendor/availability" className="underline">weekly hours</Link>.</p>
        </div>
        <Link href="/vendor/services/new" className="inline-flex h-11 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">New service</Link>
      </div>
      {rows.length === 0 ? <EmptyState title="No services yet" description="Start with a draft. You can save it and come back before submitting." action={{ href: "/vendor/services/new", label: "Create your first service" }} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-forest-900/10 text-xs uppercase tracking-wide text-ink/65"><tr><th className="px-4 py-3">Service</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Pricing</th><th className="px-4 py-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-forest-900/8">
              {rows.map((r) => {
                const cover = [...r.service_images].sort((a, b) => a.sort_order - b.sort_order)[0];
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/vendor/services/${r.id}`} className="flex items-center gap-3">
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest-50">{cover ? <Image src={serviceImageUrl(cover.path) ?? ""} alt="" fill sizes="48px" className="object-cover" unoptimized={!serviceImageUrl(cover.path)} /> : null}</span>
                        <span><span className="font-medium text-forest-800 underline">{r.name}</span><span className="block text-xs text-ink/65">{r.service_categories?.name}</span></span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} />{r.status === "approved" && !r.is_available ? <span className="ml-2 text-xs text-ink/65">paused</span> : null}</td>
                    <td className="px-4 py-3 text-ink/80">{servicePriceText(r.pricing_model, r.price_inr, r.price_unit)}</td>
                    <td className="px-4 py-3 text-ink/65">{formatDate(r.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
