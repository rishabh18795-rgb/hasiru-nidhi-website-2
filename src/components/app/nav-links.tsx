"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, Building2, CalendarCheck, CalendarDays, ClipboardList, Heart, Inbox, LayoutDashboard,
  ScrollText, Settings, ShieldAlert, Star, Tags, UserRound, Users, type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard, bookings: CalendarCheck, saved: Heart, profile: UserRound, notifications: Bell,
  properties: Building2, calendar: CalendarDays, enquiries: Inbox, settings: Settings, users: Users,
  catalog: Tags, reports: ShieldAlert, queue: ClipboardList, reviews: Star, audit: ScrollText,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Exact match only (for the overview route). */
  exact?: boolean;
  badge?: number;
}

export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-forest-800 text-cream" : "text-forest-900/75 hover:bg-forest-900/5 hover:text-forest-900",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
            {item.badge ? (
              <span className="ml-auto rounded-full bg-sand-400 px-1.5 text-[11px] font-semibold text-forest-950">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
