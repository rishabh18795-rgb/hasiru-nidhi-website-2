import Link from "next/link";
import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { HostSignUpForm } from "@/components/auth/auth-forms";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { safeNextPath } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Create your host account", robots: { index: false, follow: false } };

/** Host registration: the account type is decided by the server action behind this form, not by anything the visitor sends. */
export default async function HostRegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNextPath(sp.next, "") : "";
  const hostNext = next.startsWith("/host") ? next : "";
  return (
    <AppPage narrow title="Create your host account" description="List your property on Hasiru Nidhi. Verify your email to continue to the listing steps. Your property stays unpublished until our team approves it.">
      {isSupabaseConfigured() ? (
        <Card>
          <GoogleButton intent="host" next={hostNext || undefined} />
          <OrDivider />
          <HostSignUpForm next={hostNext || undefined} />
          <p className="mt-6 text-center text-sm text-ink/65">
            Already a host?{" "}
            <Link href="/host/login" className="font-medium text-forest-800 underline underline-offset-2">Host login</Link>
          </p>
        </Card>
      ) : (
        <BackendNotice feature="Host registration" />
      )}
    </AppPage>
  );
}
