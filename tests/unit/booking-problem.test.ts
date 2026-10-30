import { describe, expect, it } from "vitest";

import { bookingProblem } from "@/components/stays/booking-panel";

const base = { checkIn: "2026-12-10", checkOut: "2026-12-12", adults: 2, children: 0, maxGuests: 5, minNights: 1, maxNights: 7, today: "2026-12-01" };
const p = (over: Partial<typeof base> = {}) => bookingProblem({ ...base, ...over });

describe("booking panel validation (the server re-checks every rule)", () => {
  it("accepts a valid selection and an incomplete one", () => {
    expect(p()).toBeNull();
    expect(p({ checkIn: "", checkOut: "" })).toBeNull();
  });
  it("guest capacity counts adults and children together", () => {
    expect(p({ adults: 4, children: 1 })).toBeNull();
    expect(p({ adults: 4, children: 2 })).toMatch(/sleeps up to 5 guests/);
    expect(p({ adults: 0 })).toMatch(/at least one adult/i);
  });
  it("dates must be today or later, and check-out after check-in", () => {
    expect(p({ checkIn: "2026-11-30", checkOut: "2026-12-02" })).toMatch(/past/);
    expect(p({ checkOut: "2026-12-10" })).toMatch(/after check-in/);
    expect(p({ checkOut: "2026-12-09" })).toMatch(/after check-in/);
  });
  it("respects the listing's minimum and maximum stay", () => {
    expect(p({ minNights: 3 })).toMatch(/at least 3 nights/);
    expect(p({ checkOut: "2026-12-20", maxNights: 7 })).toMatch(/up to 7 nights/);
  });
});
