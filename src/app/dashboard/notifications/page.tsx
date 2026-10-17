import Link from "next/link";
import type { Metadata } from "next";

import { Card, EmptyState } from "@/components/app/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsRead } from "@/app/dashboard/actions";
import type { Notification } from "@/lib/db/types";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser("/dashboard/notifications");
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.is_read).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-forest-950">Notifications</h1>
          <p className="mt-1 text-sm text-ink/60">{unread} unread</p>
        </div>
        {unread ? (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="rounded-full border border-forest-900/20 bg-white px-4 py-2 text-sm text-forest-900 hover:bg-forest-50">Mark all as read</button>
          </form>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState title="You're all caught up" description="Booking updates and listing decisions will appear here." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={`p-4 ${n.is_read ? "" : "border-sand-400 bg-sand-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-forest-950">{n.title}</p>
                    {n.body ? <p className="mt-1 text-sm text-ink/70">{n.body}</p> : null}
                    {n.link ? <Link href={n.link} className="mt-2 inline-block text-sm text-forest-700 underline">View</Link> : null}
                  </div>
                  <time className="shrink-0 text-xs text-ink/45" dateTime={n.created_at}>{formatDateTime(n.created_at)}</time>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
