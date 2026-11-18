import type { Metadata } from "next";

import { UserDirectory } from "@/components/admin/user-directory";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["admin"], "/admin/customers");
  return <UserDirectory role="traveller" path="/admin/customers" title="Customers" sp={await searchParams} />;
}
