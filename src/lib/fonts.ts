import localFont from "next/font/local";

/**
 * The two brand fonts are served from this repository (src/fonts), not downloaded from Google at build time: a failed font download
 * broke a production build once (the build died while downloading Manrope from Google). Both are variable fonts under the
 * SIL Open Font License 1.1 (see the LICENSE-*-OFL.txt files next to them). Latin subset only, as before.
 */
export const fraunces = localFont({
  src: [
    { path: "../fonts/fraunces-latin-full-normal.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/fraunces-latin-full-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const manrope = localFont({
  src: [{ path: "../fonts/manrope-latin-wght-normal.woff2", style: "normal", weight: "200 800" }],
  variable: "--font-body",
  display: "swap",
});
