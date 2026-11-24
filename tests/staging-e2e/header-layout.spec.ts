import { test } from "@playwright/test";

import { DESKTOP_WIDTHS, MENU_WIDTHS, checkDesktopHeader, checkMenuHeader } from "../e2e/header-checks";

// STAGING: the Shop and Services modules are ON, so the header carries all 8 links: the worst case for fitting on one line.
for (const width of DESKTOP_WIDTHS) test(`desktop header at ${width}px, 8 links: one line, centred, no overlap`, async ({ page }) => checkDesktopHeader(page, width, 8));
for (const width of MENU_WIDTHS) test(`header at ${width}px, 8 links: menu reaches Shop and Services too`, async ({ page }) => checkMenuHeader(page, width, ["Explore Stays", "Nature Stay", "Shop", "Services", "Experiences", "Plan", "Gardening Services", "About"]));
