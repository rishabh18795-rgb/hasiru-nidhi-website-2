# UI/UX audit and hero fix, 24 to 25 Nov 2026

Baseline 78/100 (pre-launch audit). Final 83/100. Not 90: see "What still blocks 90".

## Home-page hero: what was wrong, and the root cause
Symptom: on first open the hero was a flat dark/grey gradient; it looked right only after scrolling or interacting.
Three causes, all reproduced on a cold image cache (screenshot `docs/screenshots/before-after/7-hero-first-paint-desktop.png`):
1. **The photograph was optimised on demand.** The source is a 2400x3600 portrait JPEG. The first visitor to a size waited for the server to decode and re-encode it (about 1 s locally, longer on a small serverless instance; AVIF encoding measured 4.5x slower than WebP). Until it arrived the hero showed only the dark background. Fix: the hero now ships as pre-cropped WebP files (landscape 1280/1920 px, portrait 720 px) served straight from the CDN, preloaded with high priority in `<head>`, over a tiny inline blurred copy of the same photograph. Result on a cold cache: image complete at 0.1 s instead of 1 s, and the first paint already shows the photograph.
2. **The hero words started invisible and waited for JavaScript.** They used a framer-motion `Reveal` (opacity 0 until hydration), so on a slow phone the first viewport was empty until the scripts loaded. Fix: pure-CSS entrance animation (`hero-rise`, `hero-zoom`) that starts at first paint and needs no JavaScript (a test proves it with JavaScript switched off).
3. **The crop showed the foggy sky, not the palms.** The portrait photo was centre-cropped for a wide hero, and heavy overlays washed it to grey. Fix: art-directed crops (landscape shows palms and paddy; phone crop shows the palms behind the text) and lighter overlays.
Also removed: the header's Shop and Services links popping in after load (they are now seeded by the server), the `quality={65}` that Next silently rounded to 75, AVIF on-demand encoding, and the 147 KB italic font preloaded on every page.

## Files changed (22 modified, 9 new)
Hero and first paint: `src/components/site/hero-backdrop.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/images/hero/hero-{landscape-1280,landscape-1920,portrait-720}.webp`, `next.config.ts`, `src/lib/fonts.ts`, `src/app/layout.tsx`, `src/components/site/navbar.tsx`, `src/components/site/footer.tsx`, `src/components/site/page-hero.tsx`, `src/app/shop/page.tsx`.
Design pass: `section-heading.tsx` (eyebrow style bug), `marketplace-showcase.tsx`, admin sidebar groups (`nav-links.tsx`, admin layout), tap targets, keyboard header menus, Google sign-in switch.
Tests added: `tests/e2e/hero.spec.ts` (10), `tests/e2e/header-keyboard.spec.ts` (4), `tests/db/commission.test.ts` (+1), `tests/staging-e2e/business-email.spec.ts` (10); updated `journeys.spec.ts` (finance wording after the 20% decision) and `site-audit.mjs` (waits for animations).

## Results on the final code
Unit and database 749/749. Browser, no backend: 331 passed, 1 skipped (known), 0 failed. Staging backend 46+24+11+5+6 passed. Staging browser 102/102. Whole-site audit (every public, customer, vendor, host, admin page, desktop and phone): 0 console errors, 0 broken images, 0 overflow, 0 serious accessibility violations (2 deliberate redirects only). Responsive audit, 10 widths from 360 to 1920: no overflow or overlap; 32 small-target flags remain (checkbox inputs and inline text links).
Mobile lab LCP (4x CPU, 1.6 Mbps): home 5.30 to 3.30 s; shop 2.82 to 1.05 s; stay detail 4.25 to 3.50 s; product 2.36 to 3.51 s (worse, see below); desktop 2.7 s home, everything else under 1.2 s; CLS 0.000 everywhere except shop 0.030.

## Scores
Homepage 87, visual design 83, typography 86, navigation and UX 87, mobile 85, customer journey 79, accessibility 86, performance 72, technical quality 91, marketplace readiness 76. UI/UX overall 83 (mean of the first eight).

## What still blocks 90
Photography is illustrative stock, and the phone hero is still mostly sky and foliage. Product pages are slower on a throttled phone than before (WebP-only images are about 25 % larger than AVIF; chosen to avoid slow first-visit encodes, worth revisiting with real traffic data). The home page's body text sits on a photograph, which no automated contrast tool can verify. Section rhythm is still repetitive (eyebrow, heading, cards). No real reviews or testimonials. Checkbox and inline-link targets under 24 px. Logo file has a white box. No payments, so the journey ends at "request".
