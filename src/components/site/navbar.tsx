"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

/** The Shop link and cart appear only while an administrator has switched them ON. Seeded from the server, then confirmed (and the cart count read) in the browser. */
function useShop(initial?: { products: boolean; services: boolean; orders: boolean }): { open: boolean; servicesOpen: boolean; ordersOpen: boolean; count: number } {
  // The server passes the flags it just read, so the Shop and Services links are in the first paint and the header does not shift when this effect confirms them.
  const [state, setState] = useState({ open: initial?.products ?? false, servicesOpen: initial?.services ?? false, ordersOpen: initial?.orders ?? false, count: 0 });
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase!.from("platform_settings").select("key, value").in("key", ["marketplace_products_enabled", "marketplace_orders_enabled", "marketplace_services_enabled"]);
      const on = (k: string) => data?.find((r) => r.key === k)?.value === true;
      const open = on("marketplace_products_enabled");
      const servicesOpen = on("marketplace_services_enabled");
      const ordersOpen = open && on("marketplace_orders_enabled");
      let count = 0;
      if (ordersOpen) {
        const { data: sessionData } = await supabase!.auth.getUser();
        if (sessionData.user) {
          const { data: rows } = await supabase!.from("cart_items").select("quantity");
          count = (rows ?? []).reduce((t, r) => t + Number(r.quantity), 0);
        }
      }
      if (!cancelled) setState({ open, servicesOpen, ordersOpen, count });
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    const onCart = () => void load();
    window.addEventListener("hn-cart-changed", onCart);
    return () => { cancelled = true; sub.subscription.unsubscribe(); window.removeEventListener("hn-cart-changed", onCart); };
  }, []);
  return state;
}

function CartLink({ count, onNavigate }: { count: number; onNavigate?: () => void }) {
  return (
    <Link href="/cart" onClick={onNavigate} aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"} className={cn("relative flex h-10 w-10 items-center justify-center rounded-full transition-colors", "text-forest-900 hover:bg-forest-900/5 hero-top:text-cream hero-top:hover:bg-white/10")}>
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {count > 0 ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sand-400 px-1 text-[11px] font-bold text-forest-950" data-testid="cart-count">{count}</span> : null}
    </Link>
  );
}

type NavEntry = (typeof navLinks)[number] | { label: string; href: string };

export function Navbar({ announcement, flags }: { announcement?: string; flags?: { products: boolean; services: boolean; orders: boolean } }) {
  const shop = useShop(flags);
  const links = useMemo<NavEntry[]>(() => [navLinks[0], navLinks[1], ...(shop.open ? [{ label: "Shop", href: "/shop" }] : []), ...(shop.servicesOpen ? [{ label: "Services", href: "/services" }] : []), ...navLinks.slice(2)], [shop.open, shop.servicesOpen]);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The header is cream by default. Only the home page (it marks its hero with data-hero) lets it be transparent over the photograph, and only
  // while the page is at the top (.nav-top). That is decided by CSS (see the hero-top variants in globals.css), not by the router's pathname:
  // the pathname is unreliable while a static page is being prerendered, and a wrong server-rendered header stayed wrong until the visitor scrolled.

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-forest-900/10 bg-cream shadow-[0_1px_0_0_rgba(23,32,26,0.04)] transition-all duration-500 hero-top-self:border-transparent hero-top-self:bg-transparent hero-top-self:shadow-none",
        !scrolled && "nav-top"
      )}
    >
      {announcement ? (
        <div className="bg-forest-900 px-4 py-1.5 text-center text-xs text-sand-200" role="status">
          {announcement}
        </div>
      ) : null}
      <nav className="mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between gap-4 px-6 sm:px-8 min-[1360px]:px-6 2xl:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Hasiru Nidhi home">
          <Image
            src={`${basePath}/brand/logo-mark.png`}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-sm object-contain"
            priority
          />
          <span
            className={cn(
              "whitespace-nowrap font-display text-xl tracking-tight text-forest-900 transition-colors hero-top:text-cream"
            )}
          >
            Hasiru Nidhi
          </span>
        </Link>

        <div className="hidden min-w-0 items-center gap-0.5 min-[1360px]:flex">
          {links.map((link) => (
            <div
              key={link.href}
              className="relative shrink-0"
              onMouseEnter={() => "children" in link && setOpenDropdown(link.label)}
              onMouseLeave={() => setOpenDropdown(null)}
              // Keyboard: the sub-menu opens when focus enters this item, closes when focus leaves it, and Escape dismisses it.
              onFocus={() => "children" in link && setOpenDropdown(link.label)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenDropdown(null); }}
              onKeyDown={(e) => { if (e.key === "Escape") setOpenDropdown(null); }}
            >
              <Link
                href={link.href}
                aria-haspopup={"children" in link && link.children ? "true" : undefined}
                aria-expanded={"children" in link && link.children ? openDropdown === link.label : undefined}
                className={cn(
                  "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-2 text-sm font-medium text-forest-900/80 transition-colors hover:bg-forest-900/5 hover:text-forest-900 hero-top:text-cream/85 hero-top:hover:bg-white/10 hero-top:hover:text-cream"
                )}
              >
                {link.label}
                {"children" in link && link.children ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
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

        <div className="hidden shrink-0 items-center gap-2 min-[1360px]:flex">
          {shop.ordersOpen ? <CartLink count={shop.count} /> : null}
          <AccountMenu />
          <LinkButton
            href="/list-your-property"
            className="shrink-0 whitespace-nowrap rounded-full bg-forest-800 px-5 text-cream hover:bg-forest-700"
            size="lg"
          >
            List Your Property
          </LinkButton>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-forest-900 min-[1360px]:hidden hero-top:text-cream"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <SheetContent side="right" className="w-[85%] gap-0 bg-cream p-0">
            <SheetHeader className="border-b border-forest-900/8 p-6">
              <SheetTitle className="font-display text-lg text-forest-900">
                {siteConfig.name}
              </SheetTitle>
            </SheetHeader>
            {/* One scrolling region for the links AND the account/buttons, so nothing is ever cut off or out of reach on a short screen. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex flex-col gap-1 p-4">
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
                <AccountMenu onNavigate={() => setMobileOpen(false)} />
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
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
