import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { SignInForm } from "@/components/auth/auth-forms";
import { getSession, safeNextPath } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Administrator sign in", robots: { index: false, follow: false } };

/**
 * Separate administrator login. There is deliberately no registration form, no third-party sign-in and no role choice here: an account is an
 * administrator only if the database says so (set once by the audited bootstrap script), and the sign-in action refuses
 * every other account.
 */
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNextPath(sp.next, "") : "";
  const session = await getSession();
  if (session?.profile.role === "admin" && !session.profile.is_suspended) redirect(next.startsWith("/admin") ? next : "/admin");
  return (
    <AppPage narrow title="Administrator sign in" description="For Hasiru Nidhi administrators only. Access is decided on the server from your account's role; this page cannot grant it.">
      {isSupabaseConfigured() ? (
        <Card>
          <SignInForm portal="admin" next={next.startsWith("/admin") ? next : undefined} />
          <p className="mt-6 text-sm text-ink/60">Administrator accounts cannot be created from the website. If you need access, ask the platform owner.</p>
        </Card>
      ) : (
        <BackendNotice feature="Administrator sign in" />
      )}
    </AppPage>
  );
}
