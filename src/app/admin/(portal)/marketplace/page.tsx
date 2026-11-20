import type { Metadata } from "next";

import { Card, CardTitle, StatusBadge } from "@/components/app/ui";
import { AddRequirementForm } from "@/components/admin/marketplace-forms";
import { requireRole } from "@/lib/auth";
import { FLAG_KEYS } from "@/lib/flags";
import { setMarketplaceFlag, setRequirementActive } from "@/app/admin/marketplace-actions";
import type { VendorDocumentRequirement } from "@/lib/db/types";

export const metadata: Metadata = { title: "Marketplace controls" };

const FLAGS = [
  { key: FLAG_KEYS.vendorRegistration, title: "Vendor registration", help: "Lets customers apply as vendors and gives existing hosts the vendor dashboard. Turn on when you are ready to review applications." },
  { key: FLAG_KEYS.products, title: "Products (Shop)", help: "Not built yet. Leave OFF until the Products module has passed its launch checks." },
  { key: FLAG_KEYS.orders, title: "Cart, checkout and orders", help: "Lets signed-in customers add to a cart and submit UNPAID order requests. Also needs Products ON. There is no payment gateway: every order shows UNPAID, PAYMENT NOT CONFIGURED." },
  { key: FLAG_KEYS.services, title: "Services", help: "Not built yet. Leave OFF until the Services module has passed its launch checks." },
] as const;

export default async function AdminMarketplace() {
  const { supabase } = await requireRole(["admin"], "/admin/marketplace");
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
