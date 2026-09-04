/**
 * Pure client-safe keyword metrics calculation functions.
 * Rule 6: No server dependencies (drizzle, stores, cheerio) allowed here.
 */

export interface RankEntry {
  position: number | null;
  checkedAt?: string | Date;
}

export interface BestRankResult {
  bestRank: number | null;
  /** Delta between current (latest) rank and historical best.
   * 0 means currently at best rank ("="),
   * negative (e.g. -2) means dropped 2 positions from peak,
   * null if not currently ranked or no rank history. */
  deltaFromBest: number | null;
}

export type RankDeltaDirection = "up" | "down" | "same" | "none";

export interface RankDeltaResult {
  delta: number | null;
  direction: RankDeltaDirection;
}

/**
 * Computes the historical best rank and the deviation of the latest rank from it.
 * ranks is assumed to be ordered chronological desc (index 0 is latest).
 */
export function calculateBestRank(ranks: RankEntry[] = []): BestRankResult {
  const validPositions = ranks
    .map((r) => r.position)
    .filter((pos): pos is number => typeof pos === "number" && pos > 0);

  if (validPositions.length === 0) {
    return { bestRank: null, deltaFromBest: null };
  }

  const bestRank = Math.min(...validPositions);
  const latest = ranks[0]?.position ?? null;

  if (latest === null || latest <= 0) {
    return { bestRank, deltaFromBest: null };
  }

  if (latest === bestRank) {
    return { bestRank, deltaFromBest: 0 };
  }

  // Dropped from peak: e.g. best was 2, latest is 4 -> deltaFromBest is -2
  return { bestRank, deltaFromBest: -(latest - bestRank) };
}

/**
 * Computes the position change between the latest rank and previous rank.
 * Ranks are 1-based (position 1 is better than position 5).
 */
export function calculateRankDelta(
  latest: number | null | undefined,
  previous: number | null | undefined,
): RankDeltaResult {
  if (typeof latest !== "number" || latest <= 0 || typeof previous !== "number" || previous <= 0) {
    return { delta: null, direction: "none" };
  }

  if (latest === previous) {
    return { delta: 0, direction: "same" };
  }

  if (latest < previous) {
    // Improved rank (e.g. from 5 to 3: +2)
    return { delta: previous - latest, direction: "up" };
  }

  // Dropped rank (e.g. from 3 to 5: -2)
  return { delta: latest - previous, direction: "down" };
}

/**
 * Normalized 0-100 Effectiveness score balancing demand (volume) and competitiveness (difficulty).
 * High volume + low difficulty = high effectiveness.
 */
export function calculateEffectiveness(
  volume: number | null | undefined,
  difficulty: number | null | undefined,
): number | null {
  if (typeof volume !== "number" || typeof difficulty !== "number") {
    return null;
  }
  const v = Math.max(0, Math.min(100, volume));
  const d = Math.max(0, Math.min(100, difficulty));
  // 60% weight on search volume, 40% on ease (100 - difficulty)
  return Math.round(v * 0.6 + (100 - d) * 0.4);
}
