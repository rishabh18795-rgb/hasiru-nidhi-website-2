"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, ShieldCheck, Store, User } from "lucide-react";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

type Role = "traveller" | "host" | "admin";
interface Me {
  name: string;
  role: Role;
}

/**
 * Reads the session in the browser so marketing pages remain static. This is display-only: every
 * protected route and action re-verifies the session and role on the server.
 */
export function AccountMenu({ solid, onNavigate }: { solid: boolean; onNavigate?: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [loaded, setLoaded] = useState<Me | null | undefined>(undefined);
  // Without a configured backend there is nothing to load: treat as signed out.
  const me = supabase ? loaded : null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function load() {
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      if (!user) {
        if (!cancelled) setLoaded(null);
        return;
      }
      const { data } = await supabase!.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
      if (!cancelled) setLoaded({ name: data?.full_name || user.email || "Account", role: (data?.role as Role) ?? "traveller" });
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (me === undefined) return <div className="h-10 w-20" aria-hidden="true" />;

  if (!me) {
    return (
      <Link
        href="/sign-in"
        onClick={onNavigate}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
          solid ? "text-forest-900 hover:bg-forest-900/5" : "text-cream hover:bg-white/10",
        )}
      >
        <User className="h-4 w-4" aria-hidden="true" />
        Sign in
      </Link>
    );
  }

  const initial = me.name.trim().charAt(0).toUpperCase() || "U";
  const links = [
    { href: "/dashboard", label: "My trips & account", icon: LayoutDashboard, show: true },
    { href: "/host", label: "Host portal", icon: Store, show: me.role === "host" },
    { href: "/admin", label: "Admin", icon: ShieldCheck, show: me.role === "admin" },
  ].filter((l) => l.show);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-800 text-sm font-semibold text-cream ring-2 ring-transparent transition hover:ring-sand-400 focus-visible:outline-none focus-visible:ring-sand-400"
      >
        {initial}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-forest-900/10 bg-cream shadow-xl shadow-forest-950/10">
          <div className="border-b border-forest-900/8 px-4 py-3">
            <p className="truncate text-sm font-medium text-forest-950">{me.name}</p>
            <p className="text-xs capitalize text-ink/55">{me.role}</p>
          </div>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-forest-900/85 hover:bg-forest-50"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <form action={signOut} className="border-t border-forest-900/8">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-forest-900/85 hover:bg-forest-50">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
