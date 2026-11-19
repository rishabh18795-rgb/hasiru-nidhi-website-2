import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";
import { fetchWithTimeout } from "@/lib/supabase/fetch";

const PROTECTED_PREFIXES = ["/dashboard", "/host", "/admin", "/vendor"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];
/** Entry pages of the host and admin portals: public by design (they are where signed-out visitors sign in). */
const PORTAL_ENTRY_PAGES = ["/host/login", "/host/register", "/admin/login"];

/** Where a signed-out visitor to `path` should sign in: each portal has its own login page. */
export function signInPathFor(path: string): string {
  if (path === "/admin" || path.startsWith("/admin/")) return "/admin/login";
  if (path === "/host" || path.startsWith("/host/")) return "/host/login";
  return "/sign-in";
}

/**
 * Refreshes the Supabase session cookie on every matched request and performs an OPTIMISTIC
 * redirect for signed-out visitors. This is a convenience, not security: every protected page
 * and server action re-checks the session and role on the server (see src/lib/auth.ts), and the
 * database enforces Row Level Security regardless of what the UI does.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey, configured } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isProtected = !PORTAL_ENTRY_PAGES.includes(path) && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const toSignIn = () => {
    const redirect = request.nextUrl.clone();
    redirect.pathname = signInPathFor(path);
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  };
  // Without a configured backend nobody can be signed in, so protected areas always lead to sign-in (destination kept).
  if (!configured) return isProtected ? toSignIn() : response;

  const supabase = createServerClient(url, anonKey, {
    global: { fetch: fetchWithTimeout(3000) },
    db: { retry: false },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the token with the Auth server (unlike getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) return toSignIn();
  if (user && AUTH_PAGES.includes(path)) {
    // Already signed in: go where they were heading (same-site paths only), else their dashboard.
    const wanted = request.nextUrl.searchParams.get("next");
    const safe = wanted && wanted.startsWith("/") && !wanted.startsWith("//") && !wanted.includes("\\") ? wanted : "/dashboard";
    const redirect = request.nextUrl.clone();
    const [pathname, search = ""] = safe.split("?");
    redirect.pathname = pathname;
    redirect.search = search ? `?${search}` : "";
    return NextResponse.redirect(redirect);
  }
  return response;
}
