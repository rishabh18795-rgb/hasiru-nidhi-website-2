"use client";

import { Fragment, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote, Bell, Building2, CalendarCheck, CalendarDays, ClipboardList, Heart, Inbox, LayoutDashboard, Leaf, Percent, Receipt,
  MapPin, ScrollText, Settings, ShieldAlert, ShieldCheck, Star, Store, Tags, ToggleRight, UserRound, Users, Wallet, type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard, bookings: CalendarCheck, saved: Heart, profile: UserRound, notifications: Bell,
  properties: Building2, calendar: CalendarDays, enquiries: Inbox, settings: Settings, users: Users,
  catalog: Tags, reports: ShieldAlert, queue: ClipboardList, reviews: Star, audit: ScrollText,
  verification: ShieldCheck, coverage: MapPin, vendors: Store, marketplace: ToggleRight,
  hosts: Building2, payments: Banknote, commission: Percent, settlements: Wallet, gardening: Leaf, earnings: Receipt,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Exact match only (for the overview route). */
  exact?: boolean;
  badge?: number;
  /** Optional section heading shown (on wide screens) above the first item of each group. Items of one group must be adjacent. */
  group?: string;
}

export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  // On phones the links scroll sideways: bring the current page's tab into view so it is never cut off at the edge.
  useEffect(() => {
    const nav = ref.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: current.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft - 16 });
  }, [pathname]);
  return (
    <nav ref={ref} aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item, index) => {
        const showGroup = Boolean(item.group) && item.group !== items[index - 1]?.group;
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Fragment key={item.href}>
            {showGroup ? <span className="mt-5 hidden px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-900/70 lg:block">{item.group}</span> : null}
          <Link
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
              <span className="ml-auto rounded-full bg-sand-400 px-1.5 text-[11px] font-semibold text-forest-950">{item.badge > 99 ? "99+" : item.badge}</span>
            ) : null}
          </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
