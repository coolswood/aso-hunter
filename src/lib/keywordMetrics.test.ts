import { describe, expect, it } from "bun:test";
import {
  calculateBestRank,
  calculateEffectiveness,
  calculateRankDelta,
  calibrateVolumeWithRealDemand,
  realDemandScore,
} from "./keywordMetrics";

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
  it("returns none when there is nothing to compare against", () => {
    expect(calculateRankDelta(null, null)).toEqual({ delta: null, direction: "none" });
    expect(calculateRankDelta(undefined, undefined)).toEqual({ delta: null, direction: "none" });
    expect(calculateRankDelta(5, undefined)).toEqual({ delta: null, direction: "none" });
  });

  it("marks a previously ranked term that lost its rank as dropped", () => {
    // Was #5 at the previous check, now absent from the tracked top-N
    expect(calculateRankDelta(null, 5)).toEqual({ delta: null, direction: "dropped" });
  });

  it("marks a previously absent term that gained a rank as entered", () => {
    // Was explicitly checked-and-absent (null), now ranked #5
    expect(calculateRankDelta(5, null)).toEqual({ delta: null, direction: "entered" });
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

  it("returns 0 when search demand (volume) is 0, regardless of difficulty", () => {
    expect(calculateEffectiveness(0, 0)).toBe(0);
    expect(calculateEffectiveness(0, 20)).toBe(0);
    expect(calculateEffectiveness(0, 50)).toBe(0);
    expect(calculateEffectiveness(0, 100)).toBe(0);
  });

  it("calculates balanced effectiveness score without artificial 40-point floor", () => {
    // volume 100, difficulty 0 -> 100
    expect(calculateEffectiveness(100, 0)).toBe(100);

    // volume 80, difficulty 20 -> 80 * (100 - 8) / 100 = 74
    expect(calculateEffectiveness(80, 20)).toBe(74);

    // volume 50, difficulty 50 -> 50 * (100 - 20) / 100 = 40
    expect(calculateEffectiveness(50, 50)).toBe(40);

    // volume 20, difficulty 80 -> 20 * (100 - 32) / 100 = 14
    expect(calculateEffectiveness(20, 80)).toBe(14);
  });

  it("clamps out-of-bounds input values to 0-100", () => {
    expect(calculateEffectiveness(120, -10)).toBe(100);
    expect(calculateEffectiveness(-20, 150)).toBe(0);
  });
});

describe("realDemandScore", () => {
  it("returns 0 for zero/negative visitors", () => {
    expect(realDemandScore(0)).toBe(0);
    expect(realDemandScore(-5)).toBe(0);
  });

  it("maps visitor counts onto the 0-100 log scale", () => {
    expect(realDemandScore(100)).toBe(40); // log10(101) ≈ 2
    expect(realDemandScore(10_000)).toBe(80); // log10(10_001) ≈ 4
  });

  it("saturates at 100", () => {
    expect(realDemandScore(1_000_000)).toBe(100);
  });
});

describe("calibrateVolumeWithRealDemand", () => {
  it("keeps the heuristic untouched when there is no real data", () => {
    expect(calibrateVolumeWithRealDemand(42, undefined)).toBe(42);
    expect(calibrateVolumeWithRealDemand(42, 0)).toBe(42);
    expect(calibrateVolumeWithRealDemand(null, undefined)).toBeNull();
  });

  it("never lowers the heuristic below measured demand", () => {
    // Measured 10k visitors (score 80) beats a heuristic estimate of 30
    expect(calibrateVolumeWithRealDemand(30, 10_000)).toBe(80);
    // But a strong heuristic is not deflated by modest real traffic
    expect(calibrateVolumeWithRealDemand(90, 100)).toBe(90);
  });

  it("fills in a score when the heuristic is missing but demand is measured", () => {
    expect(calibrateVolumeWithRealDemand(null, 10_000)).toBe(80);
  });
});
