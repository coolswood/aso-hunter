import { describe, expect, it } from "bun:test";
import { calculateEffectiveness } from "./keywordMetrics";
import { keywordOpportunityRank, volumeAndDifficulty } from "./research";

describe("volumeAndDifficulty", () => {
  it("returns 0 volume and 0 difficulty when no apps found (e.g. дневник с ии)", () => {
    const { volume, difficulty } = volumeAndDifficulty(0, 0);
    expect(volume).toBe(0);
    expect(difficulty).toBe(0);
  });

  it("returns 0 volume and 0 difficulty for single-app rare query without reviews", () => {
    // 1 app with only 20 reviews -> negligible demand and competition
    const { volume, difficulty } = volumeAndDifficulty(1, 20);
    expect(volume).toBe(0);
    expect(difficulty).toBe(0);
  });

  it("gives high volume to brand queries with 1 app but massive authority (e.g. Duolingo)", () => {
    // 1 app matching name, but 2,000,000 ratings
    const { volume, difficulty } = volumeAndDifficulty(1, 2_000_000);
    expect(volume).toBeGreaterThanOrEqual(80);
    expect(volume).toBeLessThanOrEqual(100);
    expect(difficulty).toBe(100);
  });

  it("gives balanced niche scores for terms with a few competitors (e.g. кпт дневник)", () => {
    // 3 apps, ~5,000 ratings
    const { volume, difficulty } = volumeAndDifficulty(3, 5_296);
    expect(volume).toBeGreaterThanOrEqual(30);
    expect(volume).toBeLessThanOrEqual(45);
    expect(difficulty).toBeGreaterThanOrEqual(45);
    expect(difficulty).toBeLessThanOrEqual(60);
  });

  it("gives high volume to broad category terms with many competitors (e.g. sleep tracker)", () => {
    // 25 matching apps, 30,000 average top ratings
    const { volume, difficulty } = volumeAndDifficulty(25, 30_000);
    expect(volume).toBeGreaterThanOrEqual(85);
    expect(difficulty).toBeGreaterThanOrEqual(68);
    expect(difficulty).toBeLessThanOrEqual(95);
  });

  it("adjusts volume according to googleMultiplier from web search validation", () => {
    const base = volumeAndDifficulty(3, 5_000, 1.0);
    const penalized = volumeAndDifficulty(3, 5_000, 0.55);
    const boosted = volumeAndDifficulty(3, 5_000, 1.25);

    expect(penalized.volume).toBeLessThan(base.volume);
    expect(boosted.volume).toBeGreaterThan(base.volume);
    // Difficulty remains dependent on competition/authority, not search multiplier
    expect(penalized.difficulty).toBe(base.difficulty);
    expect(boosted.difficulty).toBe(base.difficulty);
  });
});

describe("keywordOpportunityRank", () => {
  it("uses the same formula as the UI Effectiveness badge", () => {
    const k = { term: "coin identifier", volume: 70, difficulty: 30, rank: 4 };
    // Valid numeric inputs always yield a number from calculateEffectiveness
    const expected = calculateEffectiveness(70, 30) ?? -1;
    expect(keywordOpportunityRank(k)).toBe(expected);
  });

  it("ranks high-demand easy terms above low-demand tough ones", () => {
    const good = { term: "good", volume: 80, difficulty: 20, rank: null };
    const bad = { term: "bad", volume: 20, difficulty: 80, rank: null };
    expect(keywordOpportunityRank(good)).toBeGreaterThan(keywordOpportunityRank(bad));
  });
});
