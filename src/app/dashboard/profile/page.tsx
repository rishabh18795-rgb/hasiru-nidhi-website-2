import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/app/ui";
import { ProfileForm } from "@/components/dashboard/booking-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { profile, user } = await requireUser("/dashboard/profile");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Profile &amp; settings</h1>
      <Card>
        <CardTitle>Your details</CardTitle>
        <ProfileForm name={profile.full_name} phone={profile.phone ?? ""} email={user.email ?? profile.email ?? ""} />
      </Card>
      <Card>
        <CardTitle>Password</CardTitle>
        <p className="text-sm text-ink/70">To change your password we&apos;ll email you a secure link.</p>
        <Link href="/forgot-password" className="mt-4 inline-flex h-10 items-center rounded-full border border-forest-900/20 px-5 text-sm font-medium text-forest-900 hover:bg-forest-50">Send password reset link</Link>
      </Card>
    </div>
  );
}
