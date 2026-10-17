// The app now runs on a full-stack host (Vercel), served from the domain root, so there is no
// sub-path. These exports are kept so existing `${basePath}/images/...` references keep working.
export const basePath = "";

function resolveOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  // Vercel exposes the production hostname (no scheme) as a system variable.
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;
  return "http://localhost:3000";
}

export const siteOrigin = resolveOrigin();
export const siteUrl = siteOrigin;
