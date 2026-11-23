import Link from "next/link";

import { Card } from "@/components/app/ui";
import { UserActions } from "@/components/admin/admin-forms";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Profile } from "@/lib/db/types";

/** Shared by the Users, Hosts and Customers admin pages. The caller's page performs its own requireRole(["admin"]) first. */
export async function UserDirectory({ role, path, title, sp, detailBase }: {
  role?: "host" | "traveller";
  path: string;
  title: string;
  sp: Record<string, string | undefined>;
  detailBase?: string;
}) {
  const { supabase, user } = await requireRole(["admin"], path);
  const q = (sp.q ?? "").trim().slice(0, 80).replace(/[%,()]/g, "");
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (role) query = query.eq("role", role);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  const { data } = await query;
  const users = (data ?? []) as Profile[];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">{title}</h1>
      <form method="get" className="flex max-w-md gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label={`Search ${title.toLowerCase()}`} className="h-10 flex-1 rounded-xl border border-forest-900/15 bg-white px-3 text-sm" />
        <button type="submit" className="h-10 rounded-full bg-forest-800 px-5 text-sm font-medium text-cream hover:bg-forest-700">Search</button>
      </form>
      <p className="text-xs text-ink/65">Admin accounts can only be created through the documented SQL procedure (supabase/scripts/create_first_admin.sql); they are not manageable here.</p>
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id}>
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-forest-950">
                    {detailBase && u.role === "host" ? <Link href={`${detailBase}/${u.id}`} className="underline-offset-2 hover:underline">{u.full_name || "(no name)"}</Link> : (u.full_name || "(no name)")}{" "}
                    {u.id === user.id ? <span className="text-xs text-ink/65">(you)</span> : null}
                  </p>
                  <p className="text-sm text-ink/65">{u.email} · joined {formatDate(u.created_at)}</p>
                </div>
                <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs capitalize text-forest-800">{u.role}{u.is_suspended ? " · suspended" : ""}{u.host_verified ? " · verified" : ""}</span>
              </div>
              {u.role !== "admin" && u.id !== user.id ? <UserActions userId={u.id} role={u.role} suspended={u.is_suspended} verified={u.host_verified} /> : <p className="text-xs text-ink/65">Protected account.</p>}
            </Card>
          </li>
        ))}
        {users.length === 0 ? <li className="text-sm text-ink/65">No {title.toLowerCase()} match.</li> : null}
      </ul>
    </div>
  );
}
