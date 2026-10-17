import Link from "next/link";
import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { SignInForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Please sign in, or request a new link.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNextPath(sp.next, "") : "";
  const notice = sp.error ? NOTICES[sp.error] : null;
  return (
    <AppPage narrow title="Welcome back" description="Sign in to manage your trips, listings and bookings.">
      {isSupabaseConfigured() ? (
        <Card>
          {notice ? <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{notice}</p> : null}
          <SignInForm next={next || undefined} />
          <p className="mt-6 text-center text-sm text-ink/65">
            New to Hasiru Nidhi?{" "}
            <Link href="/sign-up" className="font-medium text-forest-800 underline underline-offset-2">
              Create an account
            </Link>
          </p>
        </Card>
      ) : (
        <BackendNotice feature="Signing in" />
      )}
    </AppPage>
  );
}
