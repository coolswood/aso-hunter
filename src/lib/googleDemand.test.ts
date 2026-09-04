import { describe, expect, it } from "bun:test";
import {
  calculateGoogleDemandMultiplier,
  type GoogleTrendsData,
  type GoogleWebSuggestData,
} from "./googleDemand";

describe("calculateGoogleDemandMultiplier", () => {
  it("applies strong penalty (0.55) when Google Web Suggest has zero results and no trend topic", () => {
    const web: GoogleWebSuggestData = {
      suggestions: [],
      maxRelevance: 0,
      exactMatch: false,
      matchingSuggestionsCount: 0,
      isNavigational: false,
    };
    const trends: GoogleTrendsData = {
      hasTopic: false,
      isAppOrSoftware: false,
      topics: [],
    };

    const multiplier = calculateGoogleDemandMultiplier(web, trends);
    expect(multiplier).toBe(0.55);
  });

  it("penalizes queries (0.65) where suggestions exist but none contain the query words", () => {
    const web: GoogleWebSuggestData = {
      suggestions: ["random topic 1", "random topic 2"],
      maxRelevance: 550,
      exactMatch: false,
      matchingSuggestionsCount: 0,
      isNavigational: false,
    };
    const trends: GoogleTrendsData = {
      hasTopic: false,
      isAppOrSoftware: false,
      topics: [],
    };

    const multiplier = calculateGoogleDemandMultiplier(web, trends);
    expect(multiplier).toBe(0.65);
  });

  it("boosts major brand queries with navigational intent and software topic (up to 1.3)", () => {
    const web: GoogleWebSuggestData = {
      suggestions: ["telegram web", "telegram desktop", "telegram"],
      maxRelevance: 1250,
      exactMatch: true,
      matchingSuggestionsCount: 3,
      isNavigational: true,
    };
    const trends: GoogleTrendsData = {
      hasTopic: true,
      isAppOrSoftware: true,
      topics: [
        { mid: "/m/0zwk75g", title: "Telegram", type: "Скачиваемое программное обеспечение" },
      ],
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
    };
    const trends: GoogleTrendsData = {
      hasTopic: true,
      isAppOrSoftware: false,
      topics: [{ mid: "/m/123", title: "Sleep tracker", type: "Topic" }],
    };

    const multiplier = calculateGoogleDemandMultiplier(web, trends);
    expect(multiplier).toBeGreaterThan(1.0);
    expect(multiplier).toBeLessThanOrEqual(1.2);
  });
});
