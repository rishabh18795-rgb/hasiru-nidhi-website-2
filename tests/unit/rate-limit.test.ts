import { describe, expect, it, vi } from "vitest";

import { bucketFor, clientIp, LIMITS, withinRateLimit } from "@/lib/rate-limit";

const headers = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("prefers the proxy-set header and takes only the first forwarded address", () => {
    expect(clientIp(headers({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.7");
    expect(clientIp(headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
    expect(clientIp(headers({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
  });
  it("falls back to a shared bucket rather than throwing", () => {
    expect(clientIp(headers({}))).toBe("unknown");
  });
});

describe("bucketFor", () => {
  it("never contains the raw address, and is stable and per-action", () => {
    const b = bucketFor("enquiry", "203.0.113.7");
    expect(b).not.toContain("203.0.113.7");
    expect(b).toBe(bucketFor("enquiry", "203.0.113.7"));
    expect(b).not.toBe(bucketFor("report", "203.0.113.7"));
    expect(b.length).toBeLessThanOrEqual(200);
  });
});

describe("withinRateLimit", () => {
  it("is a no-op (allows) when the service-role key is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await withinRateLimit("enquiry", "someone")).toBe(true);
    vi.unstubAllEnvs();
  });
  it("defines sane limits for every sensitive action", () => {
    for (const l of Object.values(LIMITS)) {
      expect(l.limit).toBeGreaterThan(0);
      expect(l.windowSeconds).toBeGreaterThanOrEqual(60);
    }
  });
});
