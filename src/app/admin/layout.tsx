import type { Metadata } from "next";

// Outer shell for every /admin URL, including the public /admin/login page. Authorization lives in the
// (portal) route group's layout and in every page and action below it.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
