import { describe, expect, it } from "vitest";

import { validateSearch } from "@/components/stays/search-bar";

const today = "2026-10-30";
const v = (checkin = "", checkout = "", guests = "", pin = "") => validateSearch({ checkin, checkout, guests, pin }, today);

describe("search form rules", () => {
  it("accepts an empty search (browse everything) and a complete valid one", () => {
    expect(v()).toEqual({});
    expect(v("2026-11-01", "2026-11-03", "4")).toEqual({});
  });
  it("needs both dates or neither", () => {
    expect(v("2026-11-01").dates).toMatch(/check-out/i);
    expect(v("", "2026-11-03").dates).toMatch(/check-in/i);
  });
  it("check-out must be after check-in, and check-in cannot be in the past", () => {
    expect(v("2026-11-03", "2026-11-03").dates).toMatch(/after check-in/i);
    expect(v("2026-11-05", "2026-11-03").dates).toMatch(/after check-in/i);
    expect(v("2026-10-29", "2026-11-03").dates).toMatch(/past/i);
    expect(v("2026-10-30", "2026-10-31")).toEqual({});
  });
  it.each(["0", "-2", "2.5", "abc", "501"])("rejects %s guests", (g) => expect(v("", "", g).guests).toBeDefined());
  it.each(["1", "2", "500"])("accepts %s guests", (g) => expect(v("", "", g).guests).toBeUndefined());
  it("reports date and guest problems together", () => {
    const r = v("2026-11-05", "2026-11-03", "0");
    expect(r.dates).toBeDefined();
    expect(r.guests).toBeDefined();
  });
});

describe("PIN code field", () => {
  it("is optional, and accepts exactly six digits", () => {
    expect(v("", "", "", "")).toEqual({});
    expect(v("", "", "", "562112")).toEqual({});
  });
  it.each(["5621", "56211", "5621123", "56A112", "562 112", "abcdef"])("rejects %s", (pin) => expect(v("", "", "", pin).pin).toMatch(/6-digit/));
  it("is reported together with the other problems", () => {
    const r = v("2026-11-05", "2026-11-03", "0", "12");
    expect(r.pin).toBeDefined();
    expect(r.dates).toBeDefined();
    expect(r.guests).toBeDefined();
  });
});

