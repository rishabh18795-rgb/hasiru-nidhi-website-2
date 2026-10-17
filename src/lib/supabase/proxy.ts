import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = ["/dashboard", "/host", "/admin"];
const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password"];

/**
 * Refreshes the Supabase session cookie on every matched request and performs an OPTIMISTIC
 * redirect for signed-out visitors. This is a convenience, not security: every protected page
 * and server action re-checks the session and role on the server (see src/lib/auth.ts), and the
 * database enforces Row Level Security regardless of what the UI does.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey, configured } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  if (!configured) return response;

  const supabase = createServerClient(url, anonKey, {
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

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/sign-in";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  }
  if (user && AUTH_PAGES.includes(path)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  return response;
}
