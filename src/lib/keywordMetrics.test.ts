import { describe, expect, it } from "bun:test";
import { calculateBestRank, calculateEffectiveness, calculateRankDelta } from "./keywordMetrics";

describe("calculateBestRank", () => {
  it("returns nulls when no ranks exist", () => {
    expect(calculateBestRank([])).toEqual({ bestRank: null, deltaFromBest: null });
  });

  it("handles ranks with only null positions", () => {
    expect(calculateBestRank([{ position: null }, { position: null }])).toEqual({
      bestRank: null,
      deltaFromBest: null,
    });
  });

  it("identifies best rank and 0 delta when currently at best rank", () => {
    // Current is #1, previous were #4, #2
    const ranks = [{ position: 1 }, { position: 4 }, { position: 2 }];
    expect(calculateBestRank(ranks)).toEqual({ bestRank: 1, deltaFromBest: 0 });
  });

  it("calculates negative delta when dropped from peak", () => {
    // Best was #2, currently #4 -> dropped 2 positions (-2)
    const ranks = [{ position: 4 }, { position: 2 }, { position: 5 }];
    expect(calculateBestRank(ranks)).toEqual({ bestRank: 2, deltaFromBest: -2 });
  });

  it("handles case where app is currently unranked but was previously ranked", () => {
    const ranks = [{ position: null }, { position: 3 }, { position: 5 }];
    expect(calculateBestRank(ranks)).toEqual({ bestRank: 3, deltaFromBest: null });
  });
});

describe("calculateRankDelta", () => {
  it("returns none when latest or previous is null", () => {
    expect(calculateRankDelta(null, 5)).toEqual({ delta: null, direction: "none" });
    expect(calculateRankDelta(5, null)).toEqual({ delta: null, direction: "none" });
    expect(calculateRankDelta(undefined, undefined)).toEqual({ delta: null, direction: "none" });
  });

  it("returns same when positions are equal", () => {
    expect(calculateRankDelta(4, 4)).toEqual({ delta: 0, direction: "same" });
  });

  it("returns up when rank improved (lower position number)", () => {
    // Moved from #5 to #3
    expect(calculateRankDelta(3, 5)).toEqual({ delta: 2, direction: "up" });
  });

  it("returns down when rank dropped (higher position number)", () => {
    // Moved from #2 to #4
    expect(calculateRankDelta(4, 2)).toEqual({ delta: 2, direction: "down" });
  });
});

describe("calculateEffectiveness", () => {
  it("returns null if volume or difficulty is missing", () => {
    expect(calculateEffectiveness(null, 50)).toBeNull();
    expect(calculateEffectiveness(50, null)).toBeNull();
    expect(calculateEffectiveness(undefined, undefined)).toBeNull();
  });

  it("calculates balanced effectiveness score", () => {
    // volume 80, difficulty 20 -> 80 * 0.6 + 80 * 0.4 = 48 + 32 = 80
    expect(calculateEffectiveness(80, 20)).toBe(80);

    // volume 20, difficulty 80 -> 20 * 0.6 + 20 * 0.4 = 12 + 8 = 20
    expect(calculateEffectiveness(20, 80)).toBe(20);

    // volume 50, difficulty 50 -> 50 * 0.6 + 50 * 0.4 = 30 + 20 = 50
    expect(calculateEffectiveness(50, 50)).toBe(50);
  });

  it("clamps out-of-bounds input values to 0-100", () => {
    expect(calculateEffectiveness(120, -10)).toBe(100);
    expect(calculateEffectiveness(-20, 150)).toBe(0);
  });
});
