import gplay from "google-play-scraper";
import * as cheerio from "cheerio";
import type { StoreListing, StoreSearchHit, StoreReview } from "./types";
import { median, titleMatchesAllWords } from "./relevance";
import { withRetry } from "../withRetry";
import { storefrontLang } from "../countries";

/** google-play-scraper returns some text fields (notably `summary`) with
 * un-decoded HTML entities (e.g. "Coin identifier &amp; scanner"). */
function decodeEntities(text: string | undefined): string | undefined {
  if (!text) return text;
  return cheerio.load(`<div>${text}</div>`)("div").text();
}

function toListing(r: {
  appId: string;
  title: string;
  summary?: string;
  description?: string;
  developer: string;
  icon: string;
  score?: number;
  ratings?: number;
  genre?: string;
  version?: string;
  updated?: number;
  screenshots?: string[];
  url: string;
}): StoreListing {
  // google-play-scraper concatenates screenshots from the phone/tablet tabs
  // on the store page, which are often identical images repeated 2-3x.
  const screenshotUrls = Array.from(new Set(r.screenshots ?? []));

  return {
    platform: "ANDROID",
    storeId: r.appId,
    name: decodeEntities(r.title) ?? r.title,
    developer: r.developer ?? null,
    iconUrl: r.icon ?? null,
    url: r.url ?? null,
    category: r.genre ?? null,
    rating: r.score ?? null,
    ratingCount: r.ratings ?? null,
    title: decodeEntities(r.title) ?? null,
    subtitle: decodeEntities(r.summary) ?? null,
    description: decodeEntities(r.description) ?? null,
    screenshotCount: screenshotUrls.length || null,
    screenshotUrls,
    // Play doesn't expose a supported-locale list the way iTunes does.
    languageCount: null,
    version: r.version ?? null,
    lastUpdated: r.updated ? new Date(r.updated) : null,
  };
}

export interface LocalizedListing {
  title: string | null;
  subtitle: string | null;
  description: string | null;
}

/** Fetches the live listing copy for one storefront locale - used by the
 * localization audit to catch fields that Play Console still serves in
 * English (or, worse, with leaked AI-generation artifacts) despite the
 * locale showing up as "translated" in the language list. Returns null on
 * any fetch error rather than throwing, since a sync pass walks ~15-20
 * locales and one bad one shouldn't abort the rest. */
export async function fetchLocalizedListing(
  storeId: string,
  lang: string,
  country: string,
): Promise<LocalizedListing | null> {
  try {
    const app = await withRetry(() => gplay.app({ appId: storeId, lang, country }));
    return {
      title: decodeEntities(app.title) ?? null,
      subtitle: decodeEntities(app.summary) ?? null,
      description: decodeEntities(app.description) ?? null,
    };
  } catch {
    return null;
  }
}

export async function lookupByAppId(appId: string, country = "us"): Promise<StoreListing | null> {
  try {
    const app = await withRetry(() => gplay.app({ appId, country, lang: storefrontLang(country) }));
    return toListing(app);
  } catch {
    return null;
  }
}

export async function searchApps(
  term: string,
  country = "us",
  limit = 30,
): Promise<StoreSearchHit[]> {
  const results = await withRetry(() =>
    gplay.search({ term, num: limit, country, lang: storefrontLang(country) }),
  );
  return results.map((r) => ({
    storeId: r.appId,
    name: r.title,
    iconUrl: r.icon ?? null,
    developer: r.developer ?? null,
  }));
}

/** Finds the 1-based rank of `appId` in Play Store search results for `term`.
 * Returns null if the app doesn't appear within the top `maxPositions` (max 250). */
export async function findRank(
  term: string,
  appId: string,
  country = "us",
  maxPositions = 100,
): Promise<number | null> {
  const results = await withRetry(() =>
    gplay.search({
      term,
      num: Math.min(maxPositions, 250),
      country,
      lang: storefrontLang(country),
    }),
  );
  const index = results.findIndex((r) => r.appId === appId);
  return index === -1 ? null : index + 1;
}

/** Most recent reviews for an app, newest first. google-play-scraper caps a
 * single non-paginated call at 100 (its default `num`); that's plenty for
 * theme/sentiment analysis without needing to page through the full history. */
// google-play-scraper's own .d.ts mistypes `sort` as an instance of the enum
// rather than the enum namespace, so `gplay.sort.NEWEST` doesn't type-check
// even though it's the documented usage - pass the literal value (NEWEST = 2)
// instead of fighting the ambient types.
const SORT_NEWEST = 2;

export async function fetchReviews(
  appId: string,
  country = "us",
  num = 100,
): Promise<StoreReview[]> {
  try {
    const { data } = await withRetry(() =>
      gplay.reviews({ appId, country, lang: storefrontLang(country), sort: SORT_NEWEST, num }),
    );
    return data.map((r) => ({
      externalId: r.id,
      rating: r.score ?? null,
      title: r.title ? (decodeEntities(r.title) ?? r.title) : null,
      text: r.text ? (decodeEntities(r.text) ?? r.text) : null,
      authorName: r.userName ?? null,
      version: r.version ?? null,
      reviewedAt: r.date ? new Date(r.date) : null,
    }));
  } catch {
    return [];
  }
}

export async function autocompleteSuggestions(
  term: string,
  country = "us",
  lang?: string,
): Promise<string[]> {
  try {
    return await withRetry(() => gplay.suggest({ term, country, ...(lang ? { lang } : {}) }));
  } catch {
    return [];
  }
}

// Rating counts barely move day to day, but analyzeTerm fetches up to 10 app
// details per term and metric-refresh passes walk every tracked keyword - a
// TTL cache removes most of that traffic (and most of the 429 risk).
const RATING_COUNT_TTL_MS = 24 * 60 * 60 * 1000;
const RATING_COUNT_CACHE_MAX = 2000;
const ratingCountCache = new Map<string, { value: number; expiresAt: number }>();

async function fetchRatingCount(appId: string, country: string, lang: string): Promise<number> {
  const key = `${appId}:${country}`;
  const cached = ratingCountCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const app = await withRetry(() => gplay.app({ appId, country, lang }));
    const value = app.ratings ?? 0;
    if (ratingCountCache.size >= RATING_COUNT_CACHE_MAX) {
      const oldest = ratingCountCache.keys().next().value;
      if (oldest) ratingCountCache.delete(oldest);
    }
    ratingCountCache.set(key, { value, expiresAt: Date.now() + RATING_COUNT_TTL_MS });
    return value;
  } catch {
    // Failures are not cached: a transient error shouldn't pin a 0 for 24h
    return 0;
  }
}

/** Single search pass used to derive both a demand proxy (relevant result
 * count) and a competitiveness proxy (median rating count of the top 10
 * relevant results). Raw result counts from Play search cluster near the
 * requested `num` for almost any query, so they don't actually distinguish a
 * real phrase from a nonsense one - filtering to listings whose title
 * contains every word of the term as a whole word turns it into a real
 * relevance signal. The median (not the mean) keeps one mega-app among the
 * top results from overstating the authority of the whole set. */
export async function analyzeTerm(
  term: string,
  country = "us",
): Promise<{ resultCount: number; topAuthority: number }> {
  const lang = storefrontLang(country);
  const basic = await withRetry(() => gplay.search({ term, num: 50, country, lang }));
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const relevant = basic.filter((r) => titleMatchesAllWords(r.title, words));

  const topRelevant = relevant.slice(0, 10);
  let topAuthority = 0;
  if (topRelevant.length) {
    const ratings = await Promise.all(
      topRelevant.map((r) => fetchRatingCount(r.appId, country, lang)),
    );
    topAuthority = median(ratings);
  }
  return { resultCount: relevant.length, topAuthority };
}
