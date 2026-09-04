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

export type RankDeltaDirection = "up" | "down" | "same" | "entered" | "dropped" | "none";

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
 * Ranks are 1-based (position 1 is better than position 5). A null position
 * means "checked, not in the tracked top-N window" - so latest null after a
 * ranked check is "dropped" (fell out of the window), and a ranked latest
 * after an explicit null check is "entered" (newly inside it). An undefined
 * previous (no earlier check at all) is "none".
 */
export function calculateRankDelta(
  latest: number | null | undefined,
  previous: number | null | undefined,
): RankDeltaResult {
  if (typeof latest !== "number" || latest <= 0) {
    if (typeof previous === "number" && previous > 0) {
      return { delta: null, direction: "dropped" };
    }
    return { delta: null, direction: "none" };
  }

  if (typeof previous !== "number" || previous <= 0) {
    return { delta: null, direction: previous === undefined ? "none" : "entered" };
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
 * If search demand (volume) is 0, effectiveness is strictly 0.
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

  // If there is zero search demand, effectiveness is 0 regardless of difficulty
  if (v === 0) {
    return 0;
  }

  // 60% base volume weight + 40% ease weight (100 - difficulty), scaled by volume percentage.
  // This eliminates the artificial 40-point floor on zero/low demand keywords.
  return Math.round((v * (100 - d * 0.4)) / 100);
}

/**
 * Converts measured Play Console visitors for a term into the same 0-100
 * scale as heuristic volume (log scale: 100 visitors ≈ 40, 10k ≈ 80, 100k ≈ 100).
 */
export function realDemandScore(visitors: number): number {
  if (visitors <= 0) return 0;
  return Math.round(Math.min(100, (Math.log10(1 + visitors) / 5) * 100));
}

/**
 * Calibrates the heuristic volume score against real Play Console traffic.
 * Measured visitors are a *lower bound* on demand - the store only counts
 * visitors for terms you already get impressions for - so proven demand can
 * raise the score but never lower the estimate. Fills in a score even when
 * the heuristic is null (e.g. the store analysis call failed).
 */
export function calibrateVolumeWithRealDemand(
  volume: number | null | undefined,
  visitors: number | null | undefined,
): number | null {
  if (typeof visitors !== "number" || visitors <= 0) {
    return typeof volume === "number" ? volume : null;
  }
  const measured = realDemandScore(visitors);
  if (typeof volume !== "number") return measured;
  return Math.max(volume, measured);
}
