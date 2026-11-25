import localFont from "next/font/local";

/**
 * The two brand fonts are served from this repository (src/fonts), not downloaded from Google at build time: a failed font download
 * broke a production build once (the build died while downloading Manrope from Google). Both are variable fonts under the
 * SIL Open Font License 1.1 (see the LICENSE-*-OFL.txt files next to them). Latin subset only, as before.
 */
export const fraunces = localFont({
  src: [{ path: "../fonts/fraunces-latin-full-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-display",
  display: "swap",
});

/**
 * The italic is used once (the home-page tagline) but is 147 KB. In the same family as the upright it was preloaded on EVERY page and,
 * on a slow phone connection, competed with the page's main photograph (measured: the Shop hero image finished loading at 4.1 s with both
 * fonts ahead of it). It is its own family, not preloaded; the tagline asks for it with the `font-display-italic` class and falls back to the
 * upright face's italic until it arrives.
 */
export const frauncesItalic = localFont({
  src: [{ path: "../fonts/fraunces-latin-full-italic.woff2", style: "italic", weight: "100 900" }],
  variable: "--font-fraunces-italic",
  display: "swap",
  preload: false,
});

export const manrope = localFont({
  src: [{ path: "../fonts/manrope-latin-wght-normal.woff2", style: "normal", weight: "200 800" }],
  variable: "--font-body",
  display: "swap",
});
