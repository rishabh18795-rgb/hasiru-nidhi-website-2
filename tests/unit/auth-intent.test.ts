import { describe, expect, it } from "vitest";

import { NEW_ACCOUNT_WINDOW_MS, defaultLanding, isNewAccount, parseIntent, serializeIntent } from "@/lib/auth-intent";

describe("Google sign-in intent cookie", () => {
  it("round-trips a host intent and a safe destination", () => {
    expect(parseIntent(serializeIntent("host", "/host/properties/new"))).toEqual({ kind: "host", next: "/host/properties/new" });
    expect(parseIntent(serializeIntent("customer", null))).toEqual({ kind: "customer", next: null });
  });

  it.each([null, undefined, "", "not json", "{", "[]", '{"k":"admin"}', '{"k":42}', '{"k":"host","n":"https://evil.example"}', '{"k":"host","n":"//evil.example"}', '{"k":"host","n":"javascript:alert(1)"}'])(
    "falls back safely for tampered or malformed input %s", (raw) => {
      const r = parseIntent(raw as string | null | undefined);
      expect(["customer", "host"]).toContain(r.kind);
      expect(r.kind === "host" ? raw : "ok").toBeTruthy();
      expect(r.next === null || r.next.startsWith("/")).toBe(true);
      expect(r.next ?? "").not.toMatch(/evil|javascript/);
    });

  it("never produces an admin intent", () => {
    expect(parseIntent('{"k":"admin","n":"/admin"}').kind).toBe("customer");
  });

  it("drops an open-redirect destination when serialising", () => {
    expect(parseIntent(serializeIntent("host", "https://evil.example/x")).next).toBeNull();
  });

  it("lands hosts in the listing wizard and customers on their dashboard by default", () => {
    expect(defaultLanding("host")).toBe("/host/properties/new");
    expect(defaultLanding("customer")).toBe("/dashboard");
  });

  it("treats only recently created accounts as new (older travellers must use the explicit host upgrade)", () => {
    const now = Date.parse("2026-10-30T10:00:00Z");
    expect(isNewAccount("2026-10-30T09:55:00Z", now)).toBe(true);
    expect(isNewAccount(new Date(now - NEW_ACCOUNT_WINDOW_MS - 1000).toISOString(), now)).toBe(false);
    expect(isNewAccount("2026-10-30T10:30:00Z", now)).toBe(false); // from the future: refuse
    expect(isNewAccount(undefined, now)).toBe(false);
    expect(isNewAccount("garbage", now)).toBe(false);
  });
});
