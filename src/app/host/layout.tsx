import type { Metadata } from "next";

// Outer shell for every /host URL, including the public /host/login and /host/register pages. Authorization lives in the
// (portal) route group's layout and in every page and action below it.
export const metadata: Metadata = {
  title: { default: "Host portal", template: "%s — Host portal" },
  robots: { index: false, follow: false },
};

export default function HostRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
