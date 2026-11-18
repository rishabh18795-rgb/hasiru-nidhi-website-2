import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../../src");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe("the production build has no network dependency on Google Fonts", () => {
  it("nothing imports next/font/google or links to fonts.googleapis.com", () => {
    const offenders = walk(SRC).filter((f) => /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the brand fonts and their licences ship in the repository", () => {
    for (const f of ["fraunces-latin-full-normal.woff2", "fraunces-latin-full-italic.woff2", "manrope-latin-wght-normal.woff2", "LICENSE-Fraunces-OFL.txt", "LICENSE-Manrope-OFL.txt"]) {
      expect(fs.existsSync(path.join(SRC, "fonts", f)), f).toBe(true);
      expect(fs.statSync(path.join(SRC, "fonts", f)).size, f).toBeGreaterThan(1000);
    }
    const config = fs.readFileSync(path.join(SRC, "lib/fonts.ts"), "utf8");
    expect(config).toMatch(/next\/font\/local/);
    expect(config).toMatch(/--font-display/);
    expect(config).toMatch(/--font-body/);
  });
});

describe("every portal shows a loading state and a plain error state", () => {
  for (const dir of ["admin/(portal)", "host/(portal)", "dashboard"]) {
    it(`${dir} has loading.tsx and an error.tsx client boundary`, () => {
      expect(fs.existsSync(path.join(SRC, "app", dir, "loading.tsx"))).toBe(true);
      const err = fs.readFileSync(path.join(SRC, "app", dir, "error.tsx"), "utf8");
      expect(err).toMatch(/^"use client"/);
      expect(err).toMatch(/PortalError/);
    });
  }
});
