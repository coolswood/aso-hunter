import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { googlePlaySearchTerms, keywords } from "@/db/schema";
import { fetchReportCsv, listGcsFiles } from "./storage";

export interface SyncGooglePlayResult {
  filesProcessed: number;
  rowsInserted: number;
  uniqueTerms: number;
  totalAcquisitions: number;
}

export interface GooglePlayCandidate {
  term: string;
  acquisitions: number;
  visitors: number;
  conversionRate: number;
  lastSeenDate: string;
}

export interface GooglePlayTermStats {
  acquisitions: number;
  visitors: number;
  conversionRate: number;
}

const IGNORED_SEARCH_TERMS = new Set([
  "",
  "other",
  "no search terms specified",
  "no search term specified",
]);

/**
 * Synchronizes store_performance traffic_source reports from GCS for a specific app.
 */
export async function syncGooglePlaySearchTerms(
  appId: string,
  storeId: string,
  limitMonths = 12,
): Promise<SyncGooglePlayResult> {
  const prefix = `stats/store_performance/`;
  const allFiles = await listGcsFiles(prefix);

  // Match files for this package with traffic_source breakdown:
  // e.g. stats/store_performance/store_performance_com.cbt.mindhealthy_202608_traffic_source.csv
  const targetFiles = allFiles.filter(
    (f) => f.includes(storeId) && f.includes("traffic_source") && !f.includes("total_"), // skip total files to avoid double-counting
  );

  // Sort descending by month (YYYYMM in file name)
  targetFiles.sort((a, b) => {
    const ma = a.match(/_(\d{6})_/)?.[1] ?? "";
    const mb = b.match(/_(\d{6})_/)?.[1] ?? "";
    return mb.localeCompare(ma);
  });

  const filesToProcess = targetFiles.slice(0, limitMonths);
  let rowsInserted = 0;
  let totalAcquisitions = 0;
  const uniqueTermsSet = new Set<string>();

  for (const filePath of filesToProcess) {
    try {
      const rows = await fetchReportCsv(filePath);
      for (const row of rows) {
        const rawTerm = (row["Search term"] ?? "").trim();
        const normalizedTerm = rawTerm.toLowerCase();

        if (IGNORED_SEARCH_TERMS.has(normalizedTerm)) {
          continue;
        }

        const date = row["Date"]?.trim();
        if (!date) continue;

        const acquisitions = parseInt(row["Store listing acquisitions"] ?? "0", 10) || 0;
        const visitors = parseInt(row["Store listing visitors"] ?? "0", 10) || 0;
        const conversionRate = parseFloat(row["Store listing conversion rate"] ?? "0") || 0;

        uniqueTermsSet.add(normalizedTerm);
        totalAcquisitions += acquisitions;

        // Upsert into googlePlaySearchTerms
        await db
          .insert(googlePlaySearchTerms)
          .values({
            appId,
            date,
            searchTerm: normalizedTerm,
            acquisitions,
            visitors,
            conversionRate,
          })
          .onConflictDoUpdate({
            target: [
              googlePlaySearchTerms.appId,
              googlePlaySearchTerms.date,
              googlePlaySearchTerms.searchTerm,
            ],
            set: {
              acquisitions,
              visitors,
              conversionRate,
            },
          });

        rowsInserted++;
      }
    } catch (e) {
      console.error(`Failed to process Google Play report file ${filePath}:`, e);
    }
  }

  return {
    filesProcessed: filesToProcess.length,
    rowsInserted,
    uniqueTerms: uniqueTermsSet.size,
    totalAcquisitions,
  };
}

/**
 * Returns Google Play search terms that are NOT yet in the tracked keywords for this app.
 */
export async function getGooglePlayCandidates(
  appId: string,
  minAcquisitions = 1,
): Promise<GooglePlayCandidate[]> {
  // Get all existing tracked keywords for this app to exclude them
  const tracked = await db
    .select({ term: keywords.term })
    .from(keywords)
    .where(eq(keywords.appId, appId));

  const trackedTerms = new Set(tracked.map((t) => t.term.trim().toLowerCase()));

  // Aggregate stats per search term from googlePlaySearchTerms
  const rows = await db
    .select({
      term: googlePlaySearchTerms.searchTerm,
      acquisitions: sql<number>`SUM(${googlePlaySearchTerms.acquisitions})`,
      visitors: sql<number>`SUM(${googlePlaySearchTerms.visitors})`,
      lastSeenDate: sql<string>`MAX(${googlePlaySearchTerms.date})`,
    })
    .from(googlePlaySearchTerms)
    .where(eq(googlePlaySearchTerms.appId, appId))
    .groupBy(googlePlaySearchTerms.searchTerm)
    .orderBy(desc(sql`SUM(${googlePlaySearchTerms.acquisitions})`));

  const candidates: GooglePlayCandidate[] = [];

  for (const row of rows) {
    const term = row.term.trim().toLowerCase();
    if (IGNORED_SEARCH_TERMS.has(term) || trackedTerms.has(term)) {
      continue;
    }

    const acquisitions = Number(row.acquisitions) || 0;
    if (acquisitions < minAcquisitions) {
      continue;
    }

    const visitors = Number(row.visitors) || 0;
    const conversionRate = visitors > 0 ? acquisitions / visitors : 0;

    candidates.push({
      term,
      acquisitions,
      visitors,
      conversionRate,
      lastSeenDate: row.lastSeenDate ?? "",
    });
  }

  return candidates;
}

/**
 * Returns a map of aggregated Google Play stats for all search terms of an app.
 */
export async function getGooglePlayStatsMap(
  appId: string,
): Promise<Map<string, GooglePlayTermStats>> {
  const rows = await db
    .select({
      term: googlePlaySearchTerms.searchTerm,
      acquisitions: sql<number>`SUM(${googlePlaySearchTerms.acquisitions})`,
      visitors: sql<number>`SUM(${googlePlaySearchTerms.visitors})`,
    })
    .from(googlePlaySearchTerms)
    .where(eq(googlePlaySearchTerms.appId, appId))
    .groupBy(googlePlaySearchTerms.searchTerm);

  const statsMap = new Map<string, GooglePlayTermStats>();

  for (const row of rows) {
    const term = row.term.trim().toLowerCase();
    const acquisitions = Number(row.acquisitions) || 0;
    const visitors = Number(row.visitors) || 0;
    const conversionRate = visitors > 0 ? acquisitions / visitors : 0;

    statsMap.set(term, {
      acquisitions,
      visitors,
      conversionRate,
    });
  }

  return statsMap;
}

/**
 * Returns overall Google Play search performance summary for an app.
 */
export async function getGooglePlaySummary(appId: string): Promise<{
  totalAcquisitions: number;
  totalVisitors: number;
  uniqueTermsCount: number;
  latestDate: string | null;
}> {
  const [summary] = await db
    .select({
      totalAcquisitions: sql<number>`COALESCE(SUM(${googlePlaySearchTerms.acquisitions}), 0)`,
      totalVisitors: sql<number>`COALESCE(SUM(${googlePlaySearchTerms.visitors}), 0)`,
      uniqueTermsCount: sql<number>`COUNT(DISTINCT ${googlePlaySearchTerms.searchTerm})`,
      latestDate: sql<string | null>`MAX(${googlePlaySearchTerms.date})`,
    })
    .from(googlePlaySearchTerms)
    .where(eq(googlePlaySearchTerms.appId, appId));

  return {
    totalAcquisitions: Number(summary?.totalAcquisitions ?? 0),
    totalVisitors: Number(summary?.totalVisitors ?? 0),
    uniqueTermsCount: Number(summary?.uniqueTermsCount ?? 0),
    latestDate: summary?.latestDate ?? null,
  };
}

export interface GooglePlayTermRow {
  term: string;
  acquisitions: number;
  visitors: number;
  conversionRate: number;
  firstSeenDate: string;
  lastSeenDate: string;
  isTracked: boolean;
  trackedCountries: string[];
}

export interface GooglePlayTermsResult {
  summary: {
    totalAcquisitions: number;
    totalVisitors: number;
    overallConversionRate: number;
    uniqueTermsCount: number;
    minDate: string | null;
    maxDate: string | null;
  };
  terms: GooglePlayTermRow[];
}

/**
 * Returns aggregated Google Play search terms filtered by optional date range,
 * including tracking status for the given app.
 */
export async function getGooglePlayTermsByDateRange(
  appId: string,
  options: { startDate?: string; endDate?: string } = {},
): Promise<GooglePlayTermsResult> {
  const conditions = [eq(googlePlaySearchTerms.appId, appId)];
  if (options.startDate) {
    conditions.push(sql`${googlePlaySearchTerms.date} >= ${options.startDate}`);
  }
  if (options.endDate) {
    conditions.push(sql`${googlePlaySearchTerms.date} <= ${options.endDate}`);
  }

  const whereClause = and(...conditions);

  // 1. Get tracked keywords for this app with their countries
  const tracked = await db
    .select({ term: keywords.term, country: keywords.country })
    .from(keywords)
    .where(eq(keywords.appId, appId));

  const trackedMap = new Map<string, string[]>();
  for (const t of tracked) {
    const norm = t.term.trim().toLowerCase();
    const list = trackedMap.get(norm) ?? [];
    if (!list.includes(t.country)) list.push(t.country);
    trackedMap.set(norm, list);
  }

  // 2. Query aggregated terms within date range
  const rows = await db
    .select({
      term: googlePlaySearchTerms.searchTerm,
      acquisitions: sql<number>`COALESCE(SUM(${googlePlaySearchTerms.acquisitions}), 0)`,
      visitors: sql<number>`COALESCE(SUM(${googlePlaySearchTerms.visitors}), 0)`,
      firstSeenDate: sql<string>`MIN(${googlePlaySearchTerms.date})`,
      lastSeenDate: sql<string>`MAX(${googlePlaySearchTerms.date})`,
    })
    .from(googlePlaySearchTerms)
    .where(whereClause)
    .groupBy(googlePlaySearchTerms.searchTerm)
    .orderBy(desc(sql`SUM(${googlePlaySearchTerms.acquisitions})`));

  let totalAcquisitions = 0;
  let totalVisitors = 0;
  const terms: GooglePlayTermRow[] = [];

  for (const r of rows) {
    const term = r.term.trim().toLowerCase();
    if (IGNORED_SEARCH_TERMS.has(term)) continue;

    const acquisitions = Number(r.acquisitions) || 0;
    const visitors = Number(r.visitors) || 0;
    const conversionRate = visitors > 0 ? acquisitions / visitors : 0;

    totalAcquisitions += acquisitions;
    totalVisitors += visitors;

    const trackedCountries = trackedMap.get(term) ?? [];
    terms.push({
      term,
      acquisitions,
      visitors,
      conversionRate,
      firstSeenDate: r.firstSeenDate ?? "",
      lastSeenDate: r.lastSeenDate ?? "",
      isTracked: trackedCountries.length > 0,
      trackedCountries,
    });
  }

  // Query global min and max dates across all data for date range pickers
  const [dateBounds] = await db
    .select({
      minDate: sql<string | null>`MIN(${googlePlaySearchTerms.date})`,
      maxDate: sql<string | null>`MAX(${googlePlaySearchTerms.date})`,
    })
    .from(googlePlaySearchTerms)
    .where(eq(googlePlaySearchTerms.appId, appId));

  return {
    summary: {
      totalAcquisitions,
      totalVisitors,
      overallConversionRate: totalVisitors > 0 ? totalAcquisitions / totalVisitors : 0,
      uniqueTermsCount: terms.length,
      minDate: dateBounds?.minDate ?? null,
      maxDate: dateBounds?.maxDate ?? null,
    },
    terms,
  };
}
