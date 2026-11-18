import type { Metadata } from "next";

import { Card, CardTitle } from "@/components/app/ui";
import { SettingsForm } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettings() {
  const { supabase } = await requireRole(["admin"], "/admin/settings");
  const { data } = await supabase.from("platform_settings").select("key, value");
  const values: Record<string, string> = {};
  for (const r of data ?? []) values[r.key as string] = typeof r.value === "string" ? r.value : "";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Platform settings</h1>
      <Card>
        <CardTitle>Public contact &amp; announcement</CardTitle>
        <p className="mb-5 text-sm text-ink/65">These appear on the public site. Only enter genuine, official details — fields left empty are simply hidden.</p>
        <SettingsForm values={values} />
      </Card>
    </div>
  );
}
