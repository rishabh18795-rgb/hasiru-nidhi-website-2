import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Only routes that depend on the session. Marketing pages stay static and never hit this.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/host/:path*",
    "/admin/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/stays/:path*",
    "/list-your-property",
    "/become-a-host",
  ],
};
