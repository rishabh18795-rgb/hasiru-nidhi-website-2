import type { Metadata } from "next";

import { Card } from "@/components/app/ui";
import { PolicyForm } from "@/components/admin/order-forms";
import { requireRole } from "@/lib/auth";
import type { CategoryPolicy, ProductCategory } from "@/lib/db/types";

export const metadata: Metadata = { title: "Return policies" };

export default async function AdminOrderPolicies() {
  const { supabase } = await requireRole(["admin"], "/admin/order-policies");
  const [{ data: cats }, { data: pols }] = await Promise.all([supabase.from("product_categories").select("*").order("sort_order"), supabase.from("product_category_policies").select("*")]);
  const categories = (cats ?? []) as ProductCategory[];
  const policies = new Map(((pols ?? []) as CategoryPolicy[]).map((p) => [p.category_id, p]));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Return and replacement policies</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink/60">Set the rules per product category. <strong>Nothing is assumed:</strong> every category starts as “Not decided yet”, and customers are told so. When a rule says not accepted, requests are refused; when a number of days is set it is counted from the delivery date; a blank means no time limit. Live plants, seeds, perishable produce, compost, tools and handmade items can each get their own rule.</p>
      </div>
      <Card className="divide-y divide-forest-900/8 p-0">
        {categories.map((c) => (
          <div key={c.id} className="space-y-3 p-5">
            <p className="font-medium text-forest-950">{c.name}{!c.is_active ? <span className="ml-2 text-xs font-normal text-ink/50">disabled</span> : null}{!policies.has(c.id) ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Not configured</span> : null}</p>
            <PolicyForm categoryId={c.id} name={c.name} policy={policies.get(c.id) ?? null} />
          </div>
        ))}
      </Card>
    </div>
  );
}
