import { describe, expect, it } from "bun:test";
import { parseBulkKeywords } from "./bulkKeywords";

describe("parseBulkKeywords", () => {
  it("returns empty arrays for empty or whitespace-only input", () => {
    const res = parseBulkKeywords("   \n\n , ,  ", []);
    expect(res.newTerms).toEqual([]);
    expect(res.ignoredTerms).toEqual([]);
    expect(res.totalParsed).toBe(0);
  });

  it("splits phrases by newlines", () => {
    const input = "vpn\nsecure proxy\nfast dns";
    const res = parseBulkKeywords(input, []);
    expect(res.newTerms).toEqual(["vpn", "secure proxy", "fast dns"]);
    expect(res.ignoredTerms).toEqual([]);
    expect(res.totalParsed).toBe(3);
  });

  it("splits phrases by commas", () => {
    const input = "sleep tracker, sound machine, white noise";
    const res = parseBulkKeywords(input, []);
    expect(res.newTerms).toEqual(["sleep tracker", "sound machine", "white noise"]);
    expect(res.ignoredTerms).toEqual([]);
    expect(res.totalParsed).toBe(3);
  });

  it("splits phrases by mixed commas and newlines", () => {
    const input = "fitness coach, workout planner\ngym log\nrunning app, steps tracker";
    const res = parseBulkKeywords(input, []);
    expect(res.newTerms).toEqual([
      "fitness coach",
      "workout planner",
      "gym log",
      "running app",
      "steps tracker",
    ]);
    expect(res.totalParsed).toBe(5);
  });

  it("deduplicates terms within the input", () => {
    const input = "vpn, VPN, secure proxy\nvpn\nSecure Proxy";
    const res = parseBulkKeywords(input, []);
    expect(res.newTerms).toEqual(["vpn", "secure proxy"]);
    expect(res.totalParsed).toBe(2);
  });

  it("ignores terms already existing in the tracking list (case-insensitive)", () => {
    const input = "Habit Tracker, Water Reminder, journal, MEDITATION";
    const existing = ["habit tracker", "meditation"];
    const res = parseBulkKeywords(input, existing);

    expect(res.newTerms).toEqual(["Water Reminder", "journal"]);
    expect(res.ignoredTerms).toEqual(["Habit Tracker", "MEDITATION"]);
    expect(res.totalParsed).toBe(4);
  });

  it("handles existing terms passed as a Set", () => {
    const input = "alpha, beta, gamma";
    const existing = new Set(["beta"]);
    const res = parseBulkKeywords(input, existing);

    expect(res.newTerms).toEqual(["alpha", "gamma"]);
    expect(res.ignoredTerms).toEqual(["beta"]);
    expect(res.totalParsed).toBe(3);
  });
});
