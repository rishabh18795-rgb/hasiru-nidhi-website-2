import "server-only";

import { createAdminSupabase, isServiceRoleConfigured } from "@/lib/supabase/admin";

export function canCreateHosts(): boolean {
  return isServiceRoleConfigured();
}

/**
 * Makes a brand-new account a host. Only ever called from trusted server code right after our own sign-up action created the
 * user. It touches only traveller accounts (never an admin, never an existing host), and writes an audit entry.
 */
export async function markNewAccountAsHost(userId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/.test(userId) || !isServiceRoleConfigured()) return false;
  const admin = createAdminSupabase();
  const { data, error } = await admin.from("profiles").update({ role: "host" }).eq("id", userId).eq("role", "traveller").select("id");
  if (error || !data?.length) return false;
  await admin.from("audit_logs").insert({ actor_id: null, action: "host_signup", entity_type: "profile", entity_id: userId, details: { via: "host sign-up form" } });
  return true;
}
