import { storefrontLang } from "./countries";

export interface GoogleWebSuggestData {
  suggestions: string[];
  maxRelevance: number;
  exactMatch: boolean;
  matchingSuggestionsCount: number;
  isNavigational: boolean;
}

export interface GoogleTrendsTopic {
  mid: string;
  title: string;
  type: string;
}

export interface GoogleTrendsData {
  hasTopic: boolean;
  isAppOrSoftware: boolean;
  topics: GoogleTrendsTopic[];
}

export interface GoogleDemandSignal {
  webSuggest: GoogleWebSuggestData;
  trends: GoogleTrendsData;
  multiplier: number;
}

// In-memory cache with TTL (30 minutes) to avoid redundant requests to Google
interface CacheEntry {
  data: GoogleDemandSignal;
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const demandCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000;

function getCacheKey(term: string, country: string): string {
  return `${term.trim().toLowerCase()}:${country.toLowerCase()}`;
}

/**
 * Calculates a volume multiplier (0.5 to 1.3) based on Google search presence.
 * - Penalizes terms that have no presence in Google Web Suggest (0.55 - 0.65).
 * - Boosts recognized brands, high-relevance searches, and Google Trends software entities (up to 1.3).
 */
export function calculateGoogleDemandMultiplier(
  web: GoogleWebSuggestData,
  trends: GoogleTrendsData,
): number {
  // If Google has zero suggestions for the term
  if (web.suggestions.length === 0) {
    if (trends.hasTopic) {
      return 0.85; // Recognized topic despite no autocomplete
    }
    return 0.55; // Complete absence of web search interest
  }

  // If suggestions exist, but not a single one contains the query words
  if (web.matchingSuggestionsCount === 0 && !web.exactMatch) {
    return trends.hasTopic ? 0.85 : 0.65;
  }

  let multiplier = 1.0;

  // Web relevance boost
  if (web.isNavigational) {
    multiplier += 0.15; // User intent specifically targets this brand/app
  }
  if (web.exactMatch) {
    multiplier += 0.08;
  }
  if (web.maxRelevance >= 1000) {
    multiplier += 0.07;
  }

  // Google Trends entity recognition boost
  if (trends.hasTopic) {
    if (trends.isAppOrSoftware) {
      multiplier += 0.15;
    } else {
      multiplier += 0.07;
    }
  }

  return Math.min(1.3, Math.max(0.5, Number(multiplier.toFixed(2))));
}

/**
 * Fetches Google Web Suggest data with relevance scores and query types.
 */
export async function fetchGoogleWebSuggest(
  term: string,
  country = "us",
): Promise<GoogleWebSuggestData> {
  const lang = storefrontLang(country);
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&gl=${country}&ie=utf-8&oe=utf-8&q=${encodeURIComponent(term)}`;

  const fallback: GoogleWebSuggestData = {
    suggestions: [],
    maxRelevance: 0,
    exactMatch: false,
    matchingSuggestionsCount: 0,
    isNavigational: false,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return fallback;

    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || json.length < 2) return fallback;

    const suggestions = Array.isArray(json[1]) ? (json[1] as string[]) : [];
    const extra = (json[4] as Record<string, unknown>) || {};
    const relevanceScores = Array.isArray(extra["google:suggestrelevance"])
      ? (extra["google:suggestrelevance"] as number[])
      : [];
    const suggestTypes = Array.isArray(extra["google:suggesttype"])
      ? (extra["google:suggesttype"] as string[])
      : [];

    const normTerm = term.trim().toLowerCase();
    const words = normTerm.split(/\s+/).filter(Boolean);

    let maxRelevance = 0;
    for (const score of relevanceScores) {
      if (typeof score === "number" && score > maxRelevance) {
        maxRelevance = score;
      }
    }

    const exactMatch = suggestions.some((s) => s.toLowerCase() === normTerm);
    const matchingSuggestionsCount = suggestions.filter((s) => {
      const lower = s.toLowerCase();
      return words.every((w) => lower.includes(w));
    }).length;

    const isNavigational = suggestTypes.some((t) => t === "NAVIGATION");

    return {
      suggestions,
      maxRelevance,
      exactMatch,
      matchingSuggestionsCount,
      isNavigational,
    };
  } catch {
    return fallback;
  }
}

/**
 * Fetches Google Trends Autocomplete topics to verify entity recognition.
 */
export async function fetchGoogleTrendsSignal(
  term: string,
  country = "us",
): Promise<GoogleTrendsData> {
  const lang = storefrontLang(country);
  const url = `https://trends.google.com/trends/api/autocomplete/${encodeURIComponent(term)}?hl=${lang}`;

  const fallback: GoogleTrendsData = {
    hasTopic: false,
    isAppOrSoftware: false,
    topics: [],
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return fallback;

    const text = await res.text();
    // Google Trends responses start with ")]}',\n"
    const cleaned = text.replace(/^\)\]\}',\s*/, "");
    const parsed = JSON.parse(cleaned) as {
      default?: {
        topics?: Array<{ mid?: string; title?: string; type?: string }>;
      };
    };

    const rawTopics = parsed.default?.topics ?? [];
    const topics: GoogleTrendsTopic[] = rawTopics.map((t) => ({
      mid: t.mid ?? "",
      title: t.title ?? "",
      type: t.type ?? "",
    }));

    const softwareKeywords = ["software", "программ", "app", "application", "приложение"];
    const isAppOrSoftware = topics.some((t) => {
      const typeLower = t.type.toLowerCase();
      return softwareKeywords.some((sw) => typeLower.includes(sw));
    });

    return {
      hasTopic: topics.length > 0,
      isAppOrSoftware,
      topics,
    };
  } catch {
    return fallback;
  }
}

/**
 * Aggregates Google Web Suggest and Google Trends signals with caching.
 */
export async function getGoogleDemandSignal(
  term: string,
  country = "us",
): Promise<GoogleDemandSignal> {
  const key = getCacheKey(term, country);
  const cached = demandCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [webSuggest, trends] = await Promise.all([
    fetchGoogleWebSuggest(term, country),
    fetchGoogleTrendsSignal(term, country),
  ]);

  const multiplier = calculateGoogleDemandMultiplier(webSuggest, trends);
  const data: GoogleDemandSignal = { webSuggest, trends, multiplier };

  // Evict oldest if cache is too large
  if (demandCache.size >= MAX_CACHE_SIZE) {
    const firstKey = demandCache.keys().next().value;
    if (firstKey) demandCache.delete(firstKey);
  }

  demandCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
