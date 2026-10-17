import Link from "next/link";
import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { BackendNotice } from "@/components/site/backend-notice";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AppPage narrow title="Reset your password" description="Enter your email and we'll send you a link to choose a new password.">
      {isSupabaseConfigured() ? (
        <Card>
          <ForgotPasswordForm />
          <p className="mt-6 text-center text-sm text-ink/65">
            <Link href="/sign-in" className="font-medium text-forest-800 underline underline-offset-2">
              Back to sign in
            </Link>
          </p>
        </Card>
      ) : (
        <BackendNotice feature="Password recovery" />
      )}
    </AppPage>
  );
}
