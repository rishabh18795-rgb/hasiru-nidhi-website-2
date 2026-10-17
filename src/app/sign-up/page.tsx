import Link from "next/link";
import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { SignUpForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const defaultType = sp.type === "host" ? "host" : "traveller";
  return (
    <AppPage narrow title="Create your account" description="Travellers book stays. Hosts list properties for review. You can choose below.">
      {isSupabaseConfigured() ? (
        <Card>
          <SignUpForm defaultType={defaultType} />
          <p className="mt-6 text-center text-sm text-ink/65">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-forest-800 underline underline-offset-2">
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
