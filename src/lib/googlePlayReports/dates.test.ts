import { describe, expect, it } from "bun:test";
import { shiftIsoDate } from "./dates";

describe("shiftIsoDate", () => {
  it("shifts backwards within a month", () => {
    expect(shiftIsoDate("2026-08-13", -29)).toBe("2026-07-15");
  });

  it("handles month and year boundaries", () => {
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftIsoDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap years", () => {
    expect(shiftIsoDate("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("shifts forward", () => {
    expect(shiftIsoDate("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("passes unparseable input through unchanged", () => {
    expect(shiftIsoDate("not-a-date", -30)).toBe("not-a-date");
  });
});
