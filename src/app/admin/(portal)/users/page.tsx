import type { Metadata } from "next";

import { UserDirectory } from "@/components/admin/user-directory";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["admin"], "/admin/users");
  return <UserDirectory path="/admin/users" title="Users" sp={await searchParams} detailBase="/admin/hosts" />;
}
