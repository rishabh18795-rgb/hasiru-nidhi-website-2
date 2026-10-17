import type { Metadata } from "next";
import Link from "next/link";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AppPage narrow title="Choose a new password">
        <BackendNotice feature="Password recovery" />
      </AppPage>
    );
  }
  // The recovery link signs the user in (via /auth/callback). No session => the link was invalid/expired.
  const session = await getSession();
  return (
    <AppPage narrow title="Choose a new password">
      <Card>
        {session ? (
          <ResetPasswordForm />
        ) : (
          <p className="text-sm text-ink/70">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="font-medium text-forest-800 underline">
              Request a new one
            </Link>
            .
          </p>
        )}
      </Card>
    </AppPage>
  );
}
