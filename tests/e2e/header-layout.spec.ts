import { test } from "@playwright/test";

import { DESKTOP_WIDTHS, MENU_WIDTHS, checkDesktopHeader, checkMenuHeader } from "./header-checks";

/**
 * Header layout guard (no-backend suite: Shop and Services are not shown, so 6 links). The same checks run with all 8 links in tests/staging-e2e.
 * The desktop navigation must stay on ONE line, nothing wrapping or overlapping, and below the desktop width the mobile menu must reach every link.
 */
for (const width of DESKTOP_WIDTHS) test(`desktop header at ${width}px: one line, centred, no overlap`, async ({ page }) => checkDesktopHeader(page, width, 6));
for (const width of MENU_WIDTHS) test(`header at ${width}px: menu button, every link reachable, no sideways scroll`, async ({ page }) => checkMenuHeader(page, width, ["Explore Stays", "Nature Stay", "Experiences", "Plan", "Gardening Services", "About"]));
