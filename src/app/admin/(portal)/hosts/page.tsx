import type { Metadata } from "next";

import { UserDirectory } from "@/components/admin/user-directory";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Hosts" };

export default async function AdminHosts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["admin"], "/admin/hosts");
  return <UserDirectory role="host" path="/admin/hosts" title="Hosts" sp={await searchParams} detailBase="/admin/hosts" />;
}
