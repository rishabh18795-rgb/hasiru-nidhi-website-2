import type { Metadata } from "next";

import { Card, CardTitle } from "@/components/app/ui";
import { TimeOffForm, TimeOffList, WeeklyHoursForm } from "@/components/vendor/availability-forms";
import { ServicesGate } from "@/components/vendor/capability-gate";
import { requireUser } from "@/lib/auth";
import { getVendorContext, isCapabilityActive } from "@/lib/vendor";
import { todayIST } from "@/lib/format";
import type { AvailabilityRule, TimeOff } from "@/lib/db/types";

export const metadata: Metadata = { title: "Availability" };

export default async function VendorAvailabilityPage() {
  const { supabase, user } = await requireUser("/vendor/availability");
  const ctx = await getVendorContext(supabase, user.id);
  if (!isCapabilityActive(ctx, "services")) return <ServicesGate ctx={ctx} />;
  const [{ data: rules }, { data: off }] = await Promise.all([
    supabase.from("service_availability_rules").select("id, weekday, start_time, end_time").eq("vendor_id", ctx.vendor!.id).order("weekday"),
    supabase.from("service_time_off").select("id, starts_on, ends_on, note").eq("vendor_id", ctx.vendor!.id).gte("ends_on", todayIST()).order("starts_on"),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Availability</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/65">Your weekly hours and days off apply to all your services. Customers can only pick free times inside your hours, and a time can never be double-booked.</p>
      </div>
      <Card><CardTitle>Weekly hours (India time)</CardTitle><WeeklyHoursForm rules={(rules ?? []) as AvailabilityRule[]} /></Card>
      <Card><CardTitle>Days off</CardTitle><div className="space-y-6"><TimeOffForm /><TimeOffList items={(off ?? []) as TimeOff[]} /></div></Card>
    </div>
  );
}
