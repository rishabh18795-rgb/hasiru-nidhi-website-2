import Link from "next/link";
import { Building2, KeyRound, LogIn, Plus, UserPlus } from "lucide-react";

import { becomeHost } from "@/app/list-your-property/actions";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

const NEW_PROPERTY = "/host/properties/new";
const primary = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-forest-800 px-7 text-sm font-medium text-cream transition-colors hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40";
const secondary = "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-forest-900/25 bg-white px-6 text-sm font-medium text-forest-900 transition-colors hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest-500/40";

/**
 * The real entry points into hosting. What it shows depends on who is looking, and every button leads to a working flow:
 * signed out → create a host account or sign in (the destination is remembered); traveller → one-click upgrade;
 * host → straight into the listing wizard or their properties.
 */
export async function HostCta({ becomeNotice, className }: { becomeNotice?: boolean; className?: string }) {
  const session = isSupabaseConfigured() ? await getSession() : null;
  const role = session?.profile.role;

  return (
    <div className={cn("space-y-4", className)} id="get-started">
      {becomeNotice && role === "traveller" ? (
        <p role="status" className="rounded-xl bg-sand-50 px-4 py-3 text-sm text-earth-800">Your account is a traveller account. Switch it to a host account below to list a property.</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {role === "traveller" ? (
          <form action={becomeHost}>
            <button type="submit" className={primary}><Plus className="h-4 w-4" aria-hidden="true" /> Start Listing Your Property</button>
          </form>
        ) : (
          <Link href={NEW_PROPERTY} className={primary}><Plus className="h-4 w-4" aria-hidden="true" /> Start Listing Your Property</Link>
        )}
        {!session ? (
          <>
            <Link href={`/sign-up?type=host&next=${encodeURIComponent(NEW_PROPERTY)}`} className={secondary}><UserPlus className="h-4 w-4" aria-hidden="true" /> Create Host Account</Link>
            <Link href={`/sign-in?next=${encodeURIComponent("/host")}`} className={secondary}><LogIn className="h-4 w-4" aria-hidden="true" /> Host Login</Link>
          </>
        ) : null}
        {role === "host" || !session ? <Link href="/host/properties" className={secondary}><Building2 className="h-4 w-4" aria-hidden="true" /> Manage My Properties</Link> : null}
        {role === "admin" ? <Link href="/admin" className={secondary}><KeyRound className="h-4 w-4" aria-hidden="true" /> Open the admin area</Link> : null}
      </div>
      {!session ? <p className="text-sm text-ink/60">Create an account, verify your email, and you&apos;ll go straight to the listing steps. Already hosting? Log in and pick up where you left off.</p> : null}
      {role === "admin" ? <p className="text-sm text-ink/60">Administrator accounts review listings; they don&apos;t host. Use a separate host account to list a property.</p> : null}
    </div>
  );
}
