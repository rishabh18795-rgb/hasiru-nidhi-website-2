"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { navLinks, siteConfig } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/site/link-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function Navbar() {
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
          ? "bg-cream/85 shadow-[0_1px_0_0_rgba(23,32,26,0.06)] backdrop-blur-lg"
          : "bg-transparent"
      )}
    >
      <nav className="container-nidhi flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Hasiru Nidhi home">
          <Image
            src="/brand/logo-mark.png"
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
          {navLinks.map((link) => (
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

        <div className="hidden lg:block">
          <LinkButton
            href="/contact"
            className="rounded-full bg-forest-800 px-6 text-cream hover:bg-forest-700"
            size="lg"
          >
            Book Your Experience
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
              {navLinks.map((link) => (
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
            <div className="mt-auto p-6">
              <LinkButton
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-full bg-forest-800 text-cream hover:bg-forest-700"
                size="lg"
              >
                Book Your Experience
              </LinkButton>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
