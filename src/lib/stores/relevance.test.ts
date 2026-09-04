import { describe, expect, it } from "bun:test";
import { median, titleMatchesAllWords, tokenizeWords } from "./relevance";

describe("tokenizeWords", () => {
  it("splits on punctuation and whitespace, lowercases", () => {
    expect(tokenizeWords("Coin Identifier - AI Scanner!")).toEqual(
      new Set(["coin", "identifier", "ai", "scanner"]),
    );
  });

  it("keeps non-Latin scripts and digits as tokens", () => {
    expect(tokenizeWords("Дневник 2048")).toEqual(new Set(["дневник", "2048"]));
  });
});

describe("titleMatchesAllWords", () => {
  const words = ["ai", "scanner"];

  it("matches when every query word appears as a whole word", () => {
    expect(titleMatchesAllWords("AI Photo Scanner", words)).toBe(true);
  });

  it("does not match substrings inside other words", () => {
    // "ai" hidden inside "rain"/"hair" must not count as a match
    expect(titleMatchesAllWords("Rain Hair Trimmer", words)).toBe(false);
  });

  it("requires every word to be present", () => {
    expect(titleMatchesAllWords("AI Generator", words)).toBe(false);
  });

  it("handles empty titles and words", () => {
    expect(titleMatchesAllWords(null, words)).toBe(false);
    expect(titleMatchesAllWords("Some Title", [])).toBe(false);
  });
});

describe("median", () => {
  it("returns 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });

  it("returns the middle value for odd-length lists", () => {
    expect(median([5, 1, 9])).toBe(5);
  });

  it("averages the two middle values for even-length lists", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("is not dominated by a single whale value, unlike the mean", () => {
    // mean would be ~1M here; median reflects the nine niche competitors
    expect(median([500, 900, 1_000_000, 300, 700, 100, 400, 800, 600])).toBe(600);
  });
});
