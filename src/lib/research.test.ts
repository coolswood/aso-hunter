import { describe, expect, it } from "bun:test";
import { volumeAndDifficulty } from "./research";

describe("volumeAndDifficulty", () => {
  it("returns 0 volume and 0 difficulty when no apps and no reviews found", () => {
    const { volume, difficulty } = volumeAndDifficulty(0, 0);
    expect(volume).toBe(0);
    expect(difficulty).toBe(0);
  });

  it("applies autocomplete guarantee floor when keyword is a verified store hint", () => {
    const { volume } = volumeAndDifficulty(0, 0, true);
    expect(volume).toBeGreaterThanOrEqual(35);
  });

  it("gives high volume to brand queries with few competitors but massive authority", () => {
    // e.g. Telegram / Duolingo: 1 app matching name, but 2,000,000 ratings
    const { volume, difficulty } = volumeAndDifficulty(1, 2_000_000);
    expect(volume).toBeGreaterThanOrEqual(80);
    expect(volume).toBeLessThanOrEqual(100);
    expect(difficulty).toBe(100);
  });

  it("gives high volume and realistic difficulty to broad category terms", () => {
    // e.g. "sleep tracker": 25 matching apps, 30,000 average top ratings
    const { volume, difficulty } = volumeAndDifficulty(25, 30_000);
    expect(volume).toBeGreaterThanOrEqual(85);
    expect(difficulty).toBeGreaterThanOrEqual(70);
    expect(difficulty).toBeLessThanOrEqual(95);
  });

  it("keeps volume low for rare / niche terms with few apps and low authority", () => {
    // e.g. rare phrase: 1 app, 50 ratings
    const { volume, difficulty } = volumeAndDifficulty(1, 50);
    expect(volume).toBeLessThan(35);
    expect(difficulty).toBeLessThan(40);
  });
});
