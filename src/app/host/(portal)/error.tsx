"use client";

import { PortalError } from "@/components/app/route-fallbacks";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PortalError {...props} home="/host" homeLabel="Back to the host overview" />;
}
