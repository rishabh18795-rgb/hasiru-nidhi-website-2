import Link from "next/link";
import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { CustomerSignUpForm, HostSignUpForm } from "@/components/auth/auth-forms";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

/** `?type=host` is the host experience (reached from "List Your Property"); anything else is the traveller experience. */
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNextPath(sp.next, "") : "";
  const host = sp.type === "host" || next.startsWith("/host");
  const signInHref = `/sign-in${next ? `?next=${encodeURIComponent(next)}` : host ? `?next=${encodeURIComponent("/host")}` : ""}`;
  return (
    <AppPage
      narrow
      title={host ? "Create your host account" : "Create your account"}
      description={host
        ? "List your property on Hasiru Nidhi. Verify your email to continue to the listing steps. Your property will remain unpublished until approved by our team."
        : "Create a traveller account to save stays, send booking requests and track your trips."}
    >
      {isSupabaseConfigured() ? (
        <Card>
          <GoogleButton intent={host ? "host" : "customer"} next={next || undefined} />
          <OrDivider />
          {host ? <HostSignUpForm next={next || undefined} /> : <CustomerSignUpForm next={next || undefined} />}
          <p className="mt-6 text-center text-sm text-ink/65">
            Already have an account?{" "}
            <Link href={signInHref} className="font-medium text-forest-800 underline underline-offset-2">
              Sign in
            </Link>
          </p>
          {host ? null : (
            <p className="mt-2 text-center text-sm text-ink/65">
              Own a property?{" "}
              <Link href="/list-your-property" className="font-medium text-forest-800 underline underline-offset-2">List it as a host</Link>
            </p>
          )}
        </Card>
      ) : (
        <BackendNotice feature="Creating an account" />
      )}
    </AppPage>
  );
}
