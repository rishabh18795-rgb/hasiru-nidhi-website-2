import { describe, expect, it } from "vitest";

import { friendlyDbError } from "@/lib/action";
import { safeNextPath } from "@/lib/auth";
import { telHref, whatsappLink, whatsappMessage } from "@/lib/contact";
import { addDays, formatDate, formatINR, nightsBetween, todayIST } from "@/lib/format";
import { propertyImageUrl } from "@/lib/images";

describe("safeNextPath (open-redirect protection)", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/host/properties?x=1")).toBe("/host/properties?x=1");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", ""])("rejects %s", (bad) => {
    expect(safeNextPath(bad)).toBe("/dashboard");
  });
  it("falls back when missing", () => {
    expect(safeNextPath(null, "/x")).toBe("/x");
  });
});

describe("friendlyDbError", () => {
  it("translates workflow errors into helpful messages", () => {
    expect(friendlyDbError({ message: "dates_unavailable" })).toMatch(/no longer available/);
    expect(friendlyDbError({ message: "duplicate_request" })).toMatch(/already have an open request/);
    expect(friendlyDbError({ message: "new row violates row-level security policy" })).toMatch(/permission/);
  });
  it("lists exactly what is missing from an incomplete listing", () => {
    const msg = friendlyDbError({ message: "incomplete_listing: photos,description" });
    expect(msg).toMatch(/at least one photograph/);
    expect(msg).toMatch(/description/);
  });
  it("never leaks raw internals for unknown errors", () => {
    expect(friendlyDbError({ message: 'relation "secret_table" does not exist at character 42' })).not.toMatch(/secret_table/);
  });
});

describe("contact helpers", () => {
  it("builds a wa.me link with an encoded, pre-filled message", () => {
    const link = whatsappLink("+91 98765 43210", whatsappMessage("property", "Green Cottage"));
    expect(link).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(decodeURIComponent(link!)).toContain("Green Cottage");
  });
  it("returns null (hiding the button) when no real number is configured", () => {
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink(undefined)).toBeNull();
    expect(whatsappLink("123")).toBeNull();
  });
  it("builds tel links only for plausible numbers", () => {
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
    expect(telHref("")).toBeNull();
  });
});

describe("format helpers", () => {
  it("formats rupees in Indian grouping", () => {
    expect(formatINR(1250000)).toMatch(/12,50,000/);
    expect(formatINR(null)).toBe("");
  });
  it("formats date-only strings without shifting the day", () => {
    expect(formatDate("2026-11-01")).toMatch(/1 Nov 2026/);
  });
  it("counts nights and adds days across month boundaries", () => {
    expect(nightsBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
  it("reports today in IST, not UTC", () => {
    // 20:00 UTC on the 16th is already 01:30 IST on the 17th
    expect(todayIST(new Date("2026-10-16T20:00:00Z"))).toBe("2026-10-17");
  });
});

describe("propertyImageUrl", () => {
  it("serves bundled static images from the site root", () => {
    expect(propertyImageUrl("/images/stay/a.jpg", "static")).toBe("/images/stay/a.jpg");
  });
  it("returns null for missing paths", () => {
    expect(propertyImageUrl(null, "storage")).toBeNull();
  });
});
