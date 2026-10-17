import type { Metadata } from "next";

import { AppPage, Card } from "@/components/app/ui";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Account suspended",
  robots: { index: false, follow: false },
};

export default function AccountSuspendedPage() {
  return (
    <AppPage narrow title="Account suspended">
      <Card>
        <p className="text-sm leading-relaxed text-ink/75">
          This account has been suspended and can&apos;t be used to book, host or manage listings. If you
          think this is a mistake, please contact our support team through the contact page.
        </p>
        <form action={signOut} className="mt-6">
          <button type="submit" className="inline-flex h-11 items-center rounded-full border border-forest-900/20 bg-white px-6 text-sm font-medium text-forest-900 hover:bg-forest-50">
            Sign out
          </button>
        </form>
      </Card>
    </AppPage>
  );
}
