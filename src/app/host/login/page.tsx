import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { SignInForm } from "@/components/auth/auth-forms";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { getSession, safeNextPath } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Host login", robots: { index: false, follow: false } };

/** Separate host login: only host accounts get through (travellers use the customer sign-in). */
export default async function HostLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNextPath(sp.next, "") : "";
  const hostNext = next.startsWith("/host") ? next : "";
  const session = await getSession();
  if (session?.profile.role === "host" && !session.profile.is_suspended) redirect(hostNext || "/host");
  return (
    <AppPage narrow title="Host login" description="Sign in to manage your properties, calendar, booking requests and earnings.">
      {isSupabaseConfigured() ? (
        <Card>
          <GoogleButton intent="host" next={hostNext || undefined} />
          <OrDivider />
          <SignInForm portal="host" next={hostNext || undefined} />
          <p className="mt-6 text-center text-sm text-ink/65">
            New host?{" "}
            <Link href="/host/register" className="font-medium text-forest-800 underline underline-offset-2">Create a host account</Link>
            <br />
            Looking to book a stay?{" "}
            <Link href="/sign-in" className="font-medium text-forest-800 underline underline-offset-2">Customer sign in</Link>
          </p>
        </Card>
      ) : (
        <BackendNotice feature="Host login" />
      )}
    </AppPage>
  );
}
