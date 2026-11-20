import type { ReactNode } from "react";

import { NavLinks, type NavItem } from "@/components/app/nav-links";

/** Sidebar (desktop) / scrolling tab bar (mobile) layout shared by traveller, host and admin areas. */
export function DashboardShell({
  area,
  items,
  children,
}: {
  area: string;
  items: NavItem[];
  children: ReactNode;
}) {
  return (
    <section className="bg-cream pb-24 pt-28">
      <div className="container-nidhi grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <p className="text-eyebrow mb-3 hidden lg:block">{area}</p>
          <NavLinks items={items} label={`${area} navigation`} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
