import { describe, expect, it } from "bun:test";
import {
  calculateGoogleDemandMultiplier,
  resolveDemandMultiplier,
  type GoogleTrendsData,
  type GoogleWebSuggestData,
} from "./googleDemand";

const emptyWeb: GoogleWebSuggestData = {
  suggestions: [],
  maxRelevance: 0,
  exactMatch: false,
  matchingSuggestionsCount: 0,
  isNavigational: false,
  failed: false,
};

const emptyTrends: GoogleTrendsData = {
  hasTopic: false,
  isAppOrSoftware: false,
  topics: [],
  failed: false,
};

describe("calculateGoogleDemandMultiplier", () => {
  it("applies strong penalty (0.55) when Google Web Suggest has zero results and no trend topic", () => {
    const multiplier = calculateGoogleDemandMultiplier(emptyWeb, emptyTrends);
    expect(multiplier).toBe(0.55);
  });

  it("penalizes queries (0.65) where suggestions exist but none contain the query words", () => {
    const web: GoogleWebSuggestData = {
      suggestions: ["random topic 1", "random topic 2"],
      maxRelevance: 550,
      exactMatch: false,
      matchingSuggestionsCount: 0,
      isNavigational: false,
      failed: false,
    };

    const multiplier = calculateGoogleDemandMultiplier(web, emptyTrends);
    expect(multiplier).toBe(0.65);
  });

  it("boosts major brand queries with navigational intent and software topic (up to 1.3)", () => {
    const web: GoogleWebSuggestData = {
      suggestions: ["telegram web", "telegram desktop", "telegram"],
      maxRelevance: 1250,
      exactMatch: true,
      matchingSuggestionsCount: 3,
      isNavigational: true,
      failed: false,
    };
    const trends: GoogleTrendsData = {
      hasTopic: true,
      isAppOrSoftware: true,
      topics: [
        { mid: "/m/0zwk75g", title: "Telegram", type: "Скачиваемое программное обеспечение" },
      ],
      failed: false,
    };

    const multiplier = calculateGoogleDemandMultiplier(web, trends);
    expect(multiplier).toBeGreaterThanOrEqual(1.25);
    expect(multiplier).toBeLessThanOrEqual(1.3);
  });

  it("provides balanced validation for real categories with exact match", () => {
    const web: GoogleWebSuggestData = {
      suggestions: ["sleep tracker app", "sleep tracker device", "sleep tracker"],
      maxRelevance: 750,
      exactMatch: true,
      matchingSuggestionsCount: 3,
      isNavigational: false,
      failed: false,
    };
    const trends: GoogleTrendsData = {
      hasTopic: true,
      isAppOrSoftware: false,
      topics: [{ mid: "/m/123", title: "Sleep tracker", type: "Topic" }],
      failed: false,
    };

    const multiplier = calculateGoogleDemandMultiplier(web, trends);
    expect(multiplier).toBeGreaterThan(1.0);
    expect(multiplier).toBeLessThanOrEqual(1.2);
  });
});

describe("resolveDemandMultiplier", () => {
  it("stays neutral (1.0) when either upstream fetch failed", () => {
    // A 429/timeout is *unknown* demand, not zero demand - it must not
    // halve the volume score the way the empty-data penalty would.
    expect(resolveDemandMultiplier({ ...emptyWeb, failed: true }, emptyTrends)).toBe(1.0);
    expect(resolveDemandMultiplier(emptyWeb, { ...emptyTrends, failed: true })).toBe(1.0);
  });

  it("delegates to the heuristic multiplier when both fetches succeeded", () => {
    expect(resolveDemandMultiplier(emptyWeb, emptyTrends)).toBe(0.55);
    expect(
      resolveDemandMultiplier({ ...emptyWeb, failed: false }, { ...emptyTrends, failed: false }),
    ).toBe(0.55);
  });
});
