"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import { navLinks, siteConfig } from "@/lib/site";
import { basePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/site/link-button";
import { AccountMenu } from "@/components/site/account-menu";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** The Shop link and cart appear only while an administrator has switched them ON. Read in the browser so marketing pages stay static. */
function useShop(): { open: boolean; ordersOpen: boolean; count: number } {
  const [state, setState] = useState({ open: false, ordersOpen: false, count: 0 });
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase!.from("platform_settings").select("key, value").in("key", ["marketplace_products_enabled", "marketplace_orders_enabled"]);
      const on = (k: string) => data?.find((r) => r.key === k)?.value === true;
      const open = on("marketplace_products_enabled");
      const ordersOpen = open && on("marketplace_orders_enabled");
      let count = 0;
      if (ordersOpen) {
        const { data: sessionData } = await supabase!.auth.getUser();
        if (sessionData.user) {
          const { data: rows } = await supabase!.from("cart_items").select("quantity");
          count = (rows ?? []).reduce((t, r) => t + Number(r.quantity), 0);
        }
      }
      if (!cancelled) setState({ open, ordersOpen, count });
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    const onCart = () => void load();
    window.addEventListener("hn-cart-changed", onCart);
    return () => { cancelled = true; sub.subscription.unsubscribe(); window.removeEventListener("hn-cart-changed", onCart); };
  }, []);
  return state;
}

function CartLink({ count, solid, onNavigate }: { count: number; solid: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/cart" onClick={onNavigate} aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"} className={cn("relative flex h-10 w-10 items-center justify-center rounded-full transition-colors", solid ? "text-forest-900 hover:bg-forest-900/5" : "text-cream hover:bg-white/10")}>
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {count > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sand-400 px-1 text-[11px] font-bold text-forest-950" data-testid="cart-count">{count}</span> : null}
    </Link>
  );
}

type NavEntry = (typeof navLinks)[number] | { label: string; href: string };

export function Navbar({ announcement }: { announcement?: string }) {
  const shop = useShop();
  const links = useMemo<NavEntry[]>(() => (shop.open ? [navLinks[0], navLinks[1], { label: "Shop", href: "/shop" }, ...navLinks.slice(2)] : [...navLinks]), [shop.open]);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHome = pathname === "/";
  const solid = scrolled || !isHome;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        solid
          ? "glass rounded-none border-x-0 border-t-0 shadow-[0_1px_0_0_rgba(23,32,26,0.06)]"
          : "bg-transparent"
      )}
    >
      {announcement ? (
        <div className="bg-forest-900 px-4 py-1.5 text-center text-xs text-sand-200" role="status">
          {announcement}
        </div>
      ) : null}
      <nav className="container-nidhi flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Hasiru Nidhi home">
          <Image
            src={`${basePath}/brand/logo-mark.png`}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <span
            className={cn(
              "font-display text-xl tracking-tight transition-colors",
              solid ? "text-forest-900" : "text-cream"
            )}
          >
            Hasiru Nidhi
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <div
              key={link.href}
              className="relative"
              onMouseEnter={() => "children" in link && setOpenDropdown(link.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  solid
                    ? "text-forest-900/80 hover:bg-forest-900/5 hover:text-forest-900"
                    : "text-cream/85 hover:bg-white/10 hover:text-cream"
                )}
              >
                {link.label}
                {"children" in link && link.children ? (
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                ) : null}
              </Link>

              {"children" in link && link.children ? (
                <AnimatePresence>
                  {openDropdown === link.label ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="absolute left-1/2 top-full w-64 -translate-x-1/2 pt-2"
                    >
                      <div className="overflow-hidden rounded-2xl border border-forest-900/8 bg-cream shadow-xl shadow-forest-950/10">
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-5 py-3 text-sm text-forest-900/80 transition-colors hover:bg-forest-50 hover:text-forest-900"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              ) : null}
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {shop.ordersOpen ? <CartLink count={shop.count} solid={solid} /> : null}
          <AccountMenu solid={solid} />
          <LinkButton
            href="/list-your-property"
            className="rounded-full bg-forest-800 px-5 text-cream hover:bg-forest-700"
            size="lg"
          >
            List Your Property
          </LinkButton>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            variant="ghost"
            size="icon"
            className={cn("lg:hidden", solid ? "text-forest-900" : "text-cream")}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <SheetContent side="right" className="w-[85%] bg-cream p-0">
            <SheetHeader className="border-b border-forest-900/8 p-6">
              <SheetTitle className="font-display text-lg text-forest-900">
                {siteConfig.name}
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 overflow-y-auto p-4">
              {links.map((link) => (
                <div key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl px-4 py-3 text-base font-medium text-forest-900 hover:bg-forest-900/5"
                  >
                    {link.label}
                  </Link>
                  {"children" in link && link.children ? (
                    <div className="ml-3 flex flex-col border-l border-forest-900/10 pl-3">
                      {link.children.slice(1).map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg px-4 py-2 text-sm text-forest-900/65 hover:bg-forest-900/5 hover:text-forest-900"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-auto flex flex-col gap-3 p-6">
              {shop.ordersOpen ? <Link href="/cart" onClick={() => setMobileOpen(false)} className="flex items-center justify-between rounded-xl bg-forest-900/5 px-4 py-3 text-sm font-medium text-forest-900"><span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" aria-hidden="true" />Cart</span><span>{shop.count || ""}</span></Link> : null}
              <div className="flex items-center justify-between">
                <span className="text-sm text-forest-900/70">Account</span>
                <AccountMenu solid onNavigate={() => setMobileOpen(false)} />
              </div>
              <LinkButton
                href="/book"
                onClick={() => setMobileOpen(false)}
                variant="outline"
                className="w-full rounded-full"
                size="lg"
              >
                Farm Visit Enquiry
              </LinkButton>
              <LinkButton
                href="/list-your-property"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-full bg-forest-800 text-cream hover:bg-forest-700"
                size="lg"
              >
                List Your Property
              </LinkButton>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
