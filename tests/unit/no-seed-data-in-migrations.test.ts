import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The marketplace migrations will run against PRODUCTION. They may seed reference data (categories, the OFF feature flags, storage buckets) and
 * nothing else: no vendors, products, services, orders, requests or people. Demo data lives only in tests/staging/seed-demo.mjs and is created
 * through the real functions on the staging project.
 */
const DIR = path.join(__dirname, "../../supabase/migrations");
const ALLOWED = new Set(["public.platform_settings", "public.product_categories", "public.service_categories", "storage.buckets"]);

describe("migrations contain no demo or sample rows", () => {
  const files = fs.readdirSync(DIR).filter((f) => /^20261(12|2)/.test(f) && f >= "20261120").sort();
  it("covers the marketplace migrations", () => expect(files.length).toBeGreaterThanOrEqual(5));
  for (const f of files) {
    it(`${f}: top-level inserts only seed reference data`, () => {
      const sql = fs.readFileSync(path.join(DIR, f), "utf8");
      const tops = [...sql.matchAll(/^insert into ([a-z_.]+)/gim)].map((m) => m[1].toLowerCase());
      for (const t of tops) expect(ALLOWED.has(t), `${f} seeds ${t}`).toBe(true);
      expect(sql).not.toMatch(/\(demo\)|@staging\.test|STAGING DEMO/i);
    });
  }
});
