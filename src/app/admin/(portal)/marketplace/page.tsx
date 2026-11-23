import type { Metadata } from "next";

import Link from "next/link";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { AddRequirementForm } from "@/components/admin/marketplace-forms";
import { requireRole } from "@/lib/auth";
import { FLAG_KEYS } from "@/lib/flags";
import { setMarketplaceFlag, setRequirementActive } from "@/app/admin/marketplace-actions";
import type { VendorDocumentRequirement } from "@/lib/db/types";

export const metadata: Metadata = { title: "Marketplace controls" };

const FLAGS = [
  { key: FLAG_KEYS.vendorRegistration, title: "Vendor registration", help: "Lets customers apply as vendors and gives existing hosts the vendor dashboard. Turn on when you are ready to review applications." },
  { key: FLAG_KEYS.products, title: "Products (Shop)", help: "Shows approved products in the Shop for everyone. Turn on only when you have approved sellers and products you are happy to show." },
  { key: FLAG_KEYS.orders, title: "Cart, checkout and orders", help: "Lets signed-in customers add to a cart and submit UNPAID order requests. Also needs Products ON. There is no payment gateway: every order shows UNPAID, PAYMENT NOT CONFIGURED." },
  { key: FLAG_KEYS.services, title: "Services", help: "Shows approved services and lets signed-in customers send service requests and ask for quotations. Every request is unpaid: there is no payment gateway." },
] as const;

export default async function AdminMarketplace() {
  const { supabase } = await requireRole(["admin"], "/admin/marketplace");
  // Real counts straight from the database. Nothing here is estimated, and no money total is shown: nothing has been paid.
  const count = async (table: string, column: string, values: string[]) => {
    const { count: c } = await supabase.from(table).select("id", { count: "exact", head: true }).in(column, values);
    return c ?? 0;
  };
  const [vendorsWaiting, vendorsLive, productsWaiting, productsLive, servicesWaiting, servicesLive, ordersNew, ordersOpen, orderAsks, disputes, reqNew, reqOpen, reqDone] = await Promise.all([
    count("vendors", "status", ["submitted", "under_review"]), count("vendors", "status", ["approved"]),
    count("products", "status", ["pending_review"]), count("products", "status", ["approved"]),
    count("services", "status", ["pending_review"]), count("services", "status", ["approved"]),
    count("orders", "status", ["placed"]), count("orders", "status", ["placed", "confirmed", "packed", "shipped"]),
    count("order_requests", "status", ["requested"]), count("order_disputes", "status", ["open"]),
    count("service_requests", "status", ["submitted"]), count("service_requests", "status", ["submitted", "quoted", "accepted", "in_progress"]), count("service_requests", "status", ["completed"]),
  ]);
  const [{ data: settings }, { data: reqs }] = await Promise.all([
    supabase.from("platform_settings").select("key, value").in("key", FLAGS.map((f) => f.key)),
    supabase.from("vendor_document_requirements").select("*").order("capability").order("sort_order").order("name"),
  ]);
  const on = (key: string) => settings?.find((s) => s.key === key)?.value === true;
  const requirements = (reqs ?? []) as VendorDocumentRequirement[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Marketplace controls</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">Modules stay OFF until you switch them on. Switching one on exposes it to the public or to vendors immediately; every change is recorded in the audit log.</p>
      </div>
      <Card>
        <CardTitle>At a glance</CardTitle>
        <p className="mb-4 text-sm text-ink/60">Live counts. Items waiting for you are linked. All orders and service requests are unpaid because payment is not configured, so no revenue figure is shown.</p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Vendors waiting for review", value: vendorsWaiting, href: "/admin/vendors", alert: true },
            { label: "Products waiting for review", value: productsWaiting, href: "/admin/products", alert: true },
            { label: "Services waiting for review", value: servicesWaiting, href: "/admin/services", alert: true },
            { label: "Return, replacement or cancel requests", value: orderAsks, href: "/admin/orders", alert: true },
            { label: "Open order disputes", value: disputes, href: "/admin/orders", alert: true },
            { label: "New service requests", value: reqNew, href: "/admin/service-requests", alert: false },
            { label: "Verified vendors", value: vendorsLive, href: "/admin/vendors", alert: false },
            { label: "Live products", value: productsLive, href: "/admin/products?status=approved", alert: false },
            { label: "Live services", value: servicesLive, href: "/admin/services?status=approved", alert: false },
            { label: "Shop orders in progress", value: ordersOpen, href: "/admin/orders", alert: false },
            { label: "New shop orders", value: ordersNew, href: "/admin/orders", alert: false },
            { label: "Open service requests", value: reqOpen, href: "/admin/service-requests", alert: false },
            { label: "Completed services", value: reqDone, href: "/admin/service-requests?status=completed", alert: false },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-forest-900/10 p-4">
              <dt className="text-xs text-ink/60">{m.label}</dt>
              <dd className={`mt-1 font-display text-3xl ${m.alert && m.value > 0 ? "text-earth-700" : "text-forest-950"}`}><Link href={m.href} className="hover:underline">{m.value}</Link></dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardTitle>Feature flags</CardTitle>
        <ul className="divide-y divide-forest-900/8">
          {FLAGS.map((f) => (
            <li key={f.key} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="max-w-xl"><p className="font-medium text-forest-950">{f.title}</p><p className="text-sm text-ink/60">{f.help}</p></div>
              <form action={setMarketplaceFlag.bind(null, f.key, !on(f.key))} className="flex items-center gap-3">
                <StatusBadge status={on(f.key) ? "approved" : "draft"} />
                <button type="submit" className="h-9 rounded-full border border-forest-900/20 px-4 text-sm font-medium text-forest-900 hover:bg-forest-50">{on(f.key) ? "Turn OFF" : "Turn ON"}</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Vendor document requirements</CardTitle>
        <p className="mb-4 text-sm text-ink/60">Choose which documents vendors must provide for each part of the marketplace. These are your requirements; the platform does not claim that any document makes a vendor legally compliant. Category-specific requirements (for example for food or plants) become available once product and service categories exist.</p>
        {requirements.length === 0 ? <p className="mb-4 text-sm text-ink/60">No requirements yet: vendors can apply with a complete profile and no documents.</p> : (
          <ul className="mb-6 divide-y divide-forest-900/8">
            {requirements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className={r.is_active ? "text-forest-950" : "text-ink/40 line-through"}>{r.name} <span className="text-xs text-ink/50">· {r.capability} · {r.is_required ? "required" : "optional"}</span></span>
                <form action={setRequirementActive.bind(null, r.id, !r.is_active)}><button type="submit" className="text-forest-700 underline underline-offset-2">{r.is_active ? "Deactivate" : "Activate"}</button></form>
              </li>
            ))}
          </ul>
        )}
        <AddRequirementForm />
      </Card>
    </div>
  );
}
