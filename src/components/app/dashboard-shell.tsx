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
      <div className="container-nidhi grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside>
          <p className="text-eyebrow mb-3 hidden lg:block">{area}</p>
          <NavLinks items={items} label={`${area} navigation`} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
