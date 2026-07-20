// GitHub Pages serves this project at a repo sub-path (no custom domain),
// so every internal asset reference that isn't handled automatically by
// next/link needs this prefix. Keep in sync with `next.config.ts`.
const REPO_BASE_PATH = "/hasiru-nidhi-website-2";

export const basePath = process.env.NODE_ENV === "production" ? REPO_BASE_PATH : "";

export const siteOrigin = "https://rishabh18795-rgb.github.io";

export const siteUrl = `${siteOrigin}${REPO_BASE_PATH}`;
