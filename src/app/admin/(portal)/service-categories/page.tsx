import type { Metadata } from "next";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardTitle } from "@/components/app/ui";
import { AddServiceCategoryForm, EditServiceCategoryForm } from "@/components/admin/service-forms";
import { requireRole } from "@/lib/auth";
import { moveServiceCategory } from "@/app/admin/service-actions";
import type { ServiceCategory } from "@/lib/db/types";

export const metadata: Metadata = { title: "Service categories" };

export default async function AdminServiceCategories() {
  const { supabase } = await requireRole(["admin"], "/admin/service-categories");
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from("service_categories").select("*").order("sort_order").order("id"),
    supabase.from("services").select("category_id"),
  ]);
  const cats = (data ?? []) as ServiceCategory[];
  const count = new Map<number, number>();
  for (const r of counts ?? []) count.set(r.category_id as number, (count.get(r.category_id as number) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Service categories</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">The order here is the order on the Services page. A disabled category and all its services are hidden from customers (nothing is deleted). A category&apos;s web address is fixed when it is created.</p>
      </div>
      <Card>
        <CardTitle>Categories</CardTitle>
        <ul className="divide-y divide-forest-900/8">
          {cats.map((c, i) => (
            <li key={c.id} className="flex items-start gap-3 py-4">
              <div className="flex flex-col gap-1 pt-5">
                <form action={moveServiceCategory.bind(null, c.id, "up")}><button type="submit" disabled={i === 0} aria-label={`Move ${c.name} up`} className="rounded-full p-1.5 hover:bg-forest-50 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button></form>
                <form action={moveServiceCategory.bind(null, c.id, "down")}><button type="submit" disabled={i === cats.length - 1} aria-label={`Move ${c.name} down`} className="rounded-full p-1.5 hover:bg-forest-50 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button></form>
              </div>
              <div className="min-w-0 flex-1">
                <EditServiceCategoryForm id={c.id} name={c.name} description={c.description} isActive={c.is_active} />
                <p className="mt-1.5 text-xs text-ink/50">/services?category={c.slug} · {count.get(c.id) ?? 0} service{(count.get(c.id) ?? 0) === 1 ? "" : "s"}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card><CardTitle>Add a category</CardTitle><AddServiceCategoryForm /></Card>
    </div>
  );
}
