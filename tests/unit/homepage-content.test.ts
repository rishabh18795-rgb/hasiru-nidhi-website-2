import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../../src");
const read = (f: string) => fs.readFileSync(path.join(SRC, f), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx?|json|md)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe("the '45 minutes away from Bangalore' claim is gone everywhere", () => {
  const files = walk(SRC);
  it.each([/45\s*[-–]?\s*(60)?\s*min(ute)?s?\s+(from|away|drive|out of)/i, /roughly 45/i, /minutes from (central )?(Bengaluru|Bangalore)/i, /an hour from (Bengaluru|Bangalore)/i, /away from (Bengaluru|Bangalore)/i])("no source file matches %s", (pattern) => {
    const hits = files.filter((f) => pattern.test(fs.readFileSync(f, "utf8")));
    expect(hits.map((f) => path.relative(SRC, f))).toEqual([]);
  });
  it("the homepage has no statistics row, and the shared stats list has no 45-minutes entry", () => {
    expect(read("app/page.tsx")).not.toMatch(/StatRow/);
    expect(read("lib/content.ts")).not.toMatch(/value: "45"/);
  });
});

describe("homepage sections", () => {
  const home = read("app/page.tsx");
  it("has a distinct Gardening Services section with its own image, services and an Enquire Now call to action", () => {
    expect(home).toMatch(/id="gardening-services"/);
    expect(home).toMatch(/Gardening Services/);
    expect(home).toMatch(/images\.gardeningTools/);
    expect(home).toMatch(/gardeningServices/);
    expect(home).toMatch(/href="\/gardening#enquire"/);
    expect(home).toMatch(/Enquire Now/);
  });
  it("keeps gardening out of the stay search and says that it is separate", () => {
    const section = home.slice(home.indexOf('id="gardening-services"'), home.indexOf("{/* EXPERIENCES GRID */}"));
    expect(section).not.toMatch(/StaySearchBar|StayCard|\/stays|\/book\b/);
    expect(section).toMatch(/never create a stay booking/i);
  });
  it("offers a stay search with a PIN field, host registration and the legal links", () => {
    expect(home).toMatch(/<StaySearchBar/);
    expect(read("components/stays/search-bar.tsx")).toMatch(/name="pin"/);
    expect(home).toMatch(/href="\/host\/register"/);
    for (const href of ["/terms", "/privacy", "/cancellation-policy"]) expect(home).toContain(`href="${href}"`);
  });
  it("makes no claims the platform cannot back (no payments, no ratings, no statistics)", () => {
    expect(home).not.toMatch(/secure payment|instant booking|\d+\+ (stays|hosts|guests)/i);
  });
});

describe("gardening page", () => {
  const page = read("app/gardening/page.tsx");
  it("carries the enquiry form and an enquire anchor", () => {
    expect(page).toMatch(/id="enquire"/);
    expect(page).toMatch(/GardeningQuoteForm/);
  });
  it("is not part of stay booking", () => {
    expect(page).not.toMatch(/request_booking|StaySearchBar/);
  });
});
