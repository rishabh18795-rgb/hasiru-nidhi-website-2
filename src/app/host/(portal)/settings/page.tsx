import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { Card, CardTitle } from "@/components/app/ui";
import { ProfileForm } from "@/components/dashboard/booking-forms";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function HostSettings() {
  const { profile, user } = await requireRole(["host"], "/host/settings");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium tracking-tight text-forest-950">Host settings</h1>
      <Card>
        <CardTitle>Verification</CardTitle>
        <p className="flex items-center gap-2 text-sm text-ink/75">
          {profile.host_verified ? <><ShieldCheck className="h-4 w-4 text-forest-600" aria-hidden="true" /> Your host account is verified.</> : "Not verified yet. Verification is done by Hasiru Nidhi administrators."}
        </p>
      </Card>
      <Card>
        <CardTitle>Your details</CardTitle>
        <ProfileForm name={profile.full_name} phone={profile.phone ?? ""} email={user.email ?? profile.email ?? ""} />
      </Card>
    </div>
  );
}
