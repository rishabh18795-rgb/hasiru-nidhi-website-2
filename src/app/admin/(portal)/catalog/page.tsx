import type { Metadata } from "next";

import { Card, CardTitle } from "@/components/app/ui";
import { AddCatalogForm } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { setCatalogActive } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Catalogue" };

const KINDS = [
  { table: "property_categories", title: "Property categories", label: "category", group: false },
  { table: "amenities", title: "Facilities / amenities", label: "facility", group: true },
  { table: "experiences", title: "Experiences & activities", label: "experience", group: false },
] as const;

export default async function AdminCatalog() {
  const { supabase } = await requireRole(["admin"], "/admin/catalog");
  const results = await Promise.all(KINDS.map((k) => supabase.from(k.table).select("*").order("sort_order").order("name")));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-forest-950">Catalogue</h1>
        <p className="mt-1 text-sm text-ink/60">The vocabulary hosts and travellers choose from. Deactivate an item to hide it from new listings and filters without breaking existing ones.</p>
      </div>
      {KINDS.map((k, i) => {
        const rows = (results[i].data ?? []) as { id: number; name: string; slug: string; is_active: boolean; group_name?: string }[];
        return (
          <Card key={k.table}>
            <CardTitle>{k.title}</CardTitle>
            <ul className="mb-6 divide-y divide-forest-900/8">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className={r.is_active ? "text-forest-950" : "text-ink/40 line-through"}>{r.name}{r.group_name ? <span className="ml-2 text-xs text-ink/45">{r.group_name}</span> : null}</span>
                  <form action={setCatalogActive.bind(null, k.table, r.id, !r.is_active)}><button type="submit" className="text-forest-700 underline underline-offset-2">{r.is_active ? "Deactivate" : "Activate"}</button></form>
                </li>
              ))}
            </ul>
            <AddCatalogForm kind={k.table} label={k.label} withGroup={k.group} />
          </Card>
        );
      })}
    </div>
  );
}
