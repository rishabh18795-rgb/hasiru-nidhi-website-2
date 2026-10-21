import Link from "next/link";
import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { SignUpForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNextPath(sp.next, "") : "";
  const defaultType = sp.type === "host" || next.startsWith("/host") ? "host" : "traveller";
  const signInHref = `/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <AppPage narrow title={defaultType === "host" ? "Create your host account" : "Create your account"} description={defaultType === "host" ? "List your property on Hasiru Nidhi. After you verify your email you will go straight to the listing steps. Nothing is public until our team approves it." : "Travellers book stays. Hosts list properties for review. You can choose below."}>
      {isSupabaseConfigured() ? (
        <Card>
          <SignUpForm defaultType={defaultType} next={next || undefined} />
          <p className="mt-6 text-center text-sm text-ink/65">
            Already have an account?{" "}
            <Link href={signInHref} className="font-medium text-forest-800 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </Card>
      ) : (
        <BackendNotice feature="Creating an account" />
      )}
    </AppPage>
  );
}
