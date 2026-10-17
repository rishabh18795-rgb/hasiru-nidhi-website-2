import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural security checks. These fail the build if someone adds a protected page or server
 * action without server-side authorization, or lets an authenticated segment be prerendered.
 */
const APP = path.resolve(__dirname, "../../src/app");

function walk(dir: string, match: (f: string) => boolean, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(full)) out.push(full);
  }
  return out;
}
const read = (f: string) => fs.readFileSync(f, "utf8");
const rel = (f: string) => path.relative(APP, f);

const PROTECTED = ["dashboard", "host", "admin"] as const;
const AUTH_CALL = /require(User|Role)\(/;

describe("protected route segments", () => {
  for (const segment of PROTECTED) {
    const dir = path.join(APP, segment);

    it(`${segment}/layout.tsx authorizes and is never prerendered`, () => {
      const layout = read(path.join(dir, "layout.tsx"));
      expect(layout).toMatch(AUTH_CALL);
      expect(layout).toMatch(/export const dynamic = "force-dynamic"/);
    });

    const pages = walk(dir, (f) => f.endsWith("page.tsx"));
    it(`${segment} has pages to check`, () => expect(pages.length).toBeGreaterThan(0));
    for (const page of pages) {
      it(`${rel(page)} performs its OWN server-side auth check (layouts do not re-run on client navigation)`, () => {
        expect(read(page)).toMatch(AUTH_CALL);
      });
    }
  }

  it("admin pages require the admin role specifically", () => {
    for (const page of walk(path.join(APP, "admin"), (f) => f.endsWith("page.tsx") || f.endsWith("layout.tsx"))) {
      expect(read(page), rel(page)).toMatch(/requireRole\(\["admin"\]/);
    }
  });

  it("host pages require the host role specifically", () => {
    for (const page of walk(path.join(APP, "host"), (f) => f.endsWith("page.tsx") || f.endsWith("layout.tsx"))) {
      expect(read(page), rel(page)).toMatch(/requireRole\(\["host"\]/);
    }
  });
});

describe("server actions", () => {
  it("every exported action in host/ and admin/ authorizes through the role helper", () => {
    for (const [file, role] of [["host/actions.ts", "host"], ["admin/actions.ts", "admin"]] as const) {
      const src = read(path.join(APP, file));
      expect(src, file).toMatch(new RegExp(`assertRole\\(\\["${role}"\\]\\)`));
      const exported = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
      expect(exported.length).toBeGreaterThan(3);
      for (const name of exported) {
        const body = src.slice(src.indexOf(`export async function ${name}`)).split(/\nexport async function /)[0];
        expect(body, `${file}:${name}`).toMatch(/(hostSession|adminSession)\(\)/);
      }
    }
  });

  it("the service-role client is only imported from server-only code", () => {
    const adminModule = read(path.resolve(APP, "../lib/supabase/admin.ts"));
    expect(adminModule).toMatch(/import "server-only"/);
    const clientFiles = walk(path.resolve(APP, ".."), (f) => /\.tsx?$/.test(f)).filter((f) => /^"use client"/.test(read(f)));
    for (const f of clientFiles) expect(read(f), f).not.toMatch(/supabase\/admin|SERVICE_ROLE/);
  });

  it("no source file exposes the service-role key through a NEXT_PUBLIC_ variable", () => {
    for (const f of walk(path.resolve(APP, ".."), (f) => /\.(tsx?|md)$/.test(f))) {
      expect(read(f), f).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/);
    }
    expect(read(path.resolve(APP, "../../.env.example"))).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/);
  });
});

describe("no invented business facts", () => {
  it("does not ship hard-coded phone numbers, e-mails or WhatsApp links", () => {
    const site = read(path.resolve(APP, "../lib/site.ts"));
    expect(site).not.toMatch(/wa\.me\/\d/);
    expect(site).not.toMatch(/\+91[\s-]?\d{5}/);
    expect(site).not.toMatch(/@hasirunidhi\.com/);
  });

  it("ships no placeholder testimonials", () => {
    const content = read(path.resolve(APP, "../lib/content.ts"));
    expect(content).toMatch(/export const testimonials: Testimonial\[\] = \[\];/);
  });
});
