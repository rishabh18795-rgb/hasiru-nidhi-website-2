import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardTitle } from "@/components/app/ui";
import { CoverageForm } from "@/components/vendor/coverage-form";
import { requireUser } from "@/lib/auth";
import { getVendorContext } from "@/lib/vendor";

export const metadata: Metadata = { title: "Delivery & service areas" };

export default async function VendorCoveragePage() {
  const { supabase, user } = await requireUser("/vendor/coverage");
  const { vendor } = await getVendorContext(supabase, user.id);
  if (!vendor) redirect("/vendor/profile");
  const { data } = await supabase.from("vendor_service_areas").select("scope, pin_code, pin_prefix").eq("vendor_id", vendor.id).order("pin_code");
  const list = (scope: string) => (data ?? []).filter((a) => a.scope === scope).map((a) => (a.pin_code ?? a.pin_prefix) as string);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Delivery and service areas</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">We never assume a vendor serves every PIN code. Customers can buy your products or request your services only where you have listed coverage. Enter 6-digit PIN codes, or a 3-digit prefix (for example 560) to cover every PIN that starts with it.</p>
      </div>
      <Card>
        <CardTitle>Where you deliver products</CardTitle>
        <CoverageForm scope="delivery" title="Delivery PIN codes" help="Separate with commas, spaces or new lines. Delivery fees and shipping rules are not configured yet; this list only decides where you can receive orders." current={list("delivery")} />
      </Card>
      <Card>
        <CardTitle>Where you provide services</CardTitle>
        <CoverageForm scope="service" title="Service PIN codes" help="The areas where you can visit customers." current={list("service")} />
      </Card>
    </div>
  );
}
