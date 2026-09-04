import { Fragment, useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import { SiAppstore, SiGoogleplay } from "react-icons/si";
import RankSparkline from "../RankSparkline";
import RankHistoryChart from "../RankHistoryChart";
import { appStoreSearchUrl, playStoreSearchUrl } from "@/lib/storeLinks";
import type { StorePlatform } from "@/lib/stores/types";
import {
  calculateBestRank,
  calculateEffectiveness,
  calculateRankDelta,
  type RankEntry,
} from "@/lib/keywordMetrics";
import {
  AppsCountBadge,
  BestRankBadge,
  ChangeDeltaBadge,
  DifficultyBadge,
  EffectivenessBadge,
  PopularityBadge,
  RankBadge,
} from "./KeywordMetricBadges";

export interface KeywordWithRanks {
  id: string;
  term: string;
  country: string;
  volume: number | null;
  difficulty: number | null;
  appsCount?: number | null;
  ranks: { position: number | null; checkedAt: string | Date }[];
}

type SortField =
  "term" | "volume" | "difficulty" | "effectiveness" | "rank" | "change" | "bestRank" | "appsCount";

type SortOrder = "asc" | "desc";

export default function KeywordTable({
  appId,
  country,
  keywords,
  onChanged,
}: {
  appId: string;
  platform: StorePlatform;
  country: string;
  keywords: KeywordWithRanks[];
  onChanged?: () => void;
}) {
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Sorting
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // Sensible defaults: rank asc (1 is best), volume/apps desc (higher is better)
      setSortOrder(field === "rank" || field === "bestRank" ? "asc" : "desc");
    }
  }

  const sortedKeywords = useMemo(() => {
    return [...keywords].sort((a, b) => {
      let valA: number | string | null = null;
      let valB: number | string | null = null;

      switch (sortField) {
        case "term":
          valA = a.term.toLowerCase();
          valB = b.term.toLowerCase();
          break;
        case "volume":
          valA = a.volume ?? -1;
          valB = b.volume ?? -1;
          break;
        case "difficulty":
          valA = a.difficulty ?? -1;
          valB = b.difficulty ?? -1;
          break;
        case "effectiveness":
          valA = calculateEffectiveness(a.volume, a.difficulty) ?? -1;
          valB = calculateEffectiveness(b.volume, b.difficulty) ?? -1;
          break;
        case "rank":
          // Unranked apps pushed to the bottom
          valA = a.ranks[0]?.position ?? 9999;
          valB = b.ranks[0]?.position ?? 9999;
          break;
        case "change": {
          const deltaA = calculateRankDelta(a.ranks[0]?.position, a.ranks[1]?.position);
          const deltaB = calculateRankDelta(b.ranks[0]?.position, b.ranks[1]?.position);
          valA =
            deltaA.direction === "up"
              ? (deltaA.delta ?? 0)
              : deltaA.direction === "down"
                ? -(deltaA.delta ?? 0)
                : 0;
          valB =
            deltaB.direction === "up"
              ? (deltaB.delta ?? 0)
              : deltaB.direction === "down"
                ? -(deltaB.delta ?? 0)
                : 0;
          break;
        }
        case "bestRank": {
          valA = calculateBestRank(a.ranks).bestRank ?? 9999;
          valB = calculateBestRank(b.ranks).bestRank ?? 9999;
          break;
        }
        case "appsCount":
          valA = a.appsCount ?? -1;
          valB = b.appsCount ?? -1;
          break;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [keywords, sortField, sortOrder]);

  async function removeSingle(keywordId: string) {
    await fetch(`/api/apps/${appId}/keywords/${keywordId}`, { method: "DELETE" });
    if (expanded === keywordId) setExpanded(null);
    onChanged?.();
  }

  async function refreshAllMetrics() {
    setRefreshing(true);
    try {
      await fetch(`/api/apps/${appId}/keywords/refresh-metrics?country=${country}`, {
        method: "POST",
      });
      onChanged?.();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Main Keywords Table */}
      <div className="rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-xs overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-semibold tracking-wider text-muted uppercase select-none">
              <th
                onClick={() => handleSort("term")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>KEYWORD</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "term" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("volume")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>POPULARITY</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "volume" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("difficulty")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>DIFFICULTY</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "difficulty" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("effectiveness")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>EFFECTIVENESS</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "effectiveness" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("rank")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>RANK</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "rank" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("change")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>CHANGE</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "change" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("bestRank")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
              >
                <div className="inline-flex items-center gap-1">
                  <span>BEST RANK</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "bestRank" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th
                onClick={() => handleSort("appsCount")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors text-right"
              >
                <div className="inline-flex items-center justify-end gap-1">
                  <span>APPS</span>
                  <ArrowUpDown
                    className={`h-3 w-3 ${sortField === "appsCount" ? "text-accent" : "opacity-40"}`}
                  />
                </div>
              </th>
              <th className="py-3 px-3 text-right">
                <div className="inline-flex items-center justify-end gap-2">
                  <button
                    onClick={refreshAllMetrics}
                    disabled={refreshing}
                    title="Refresh popularity and search metrics from live store data"
                    className="text-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                  <span className="w-12 text-center">TREND</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedKeywords.map((k, i) => {
              const chronological = [...k.ranks].reverse();
              const latest = k.ranks[0]?.position ?? null;
              const previous = k.ranks[1]?.position ?? null;
              const isOpen = expanded === k.id;

              return (
                <Fragment key={k.id}>
                  <tr
                    className={`transition-colors ${
                      isOpen ? "bg-accent/5" : "hover:bg-background/60"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}
                  >
                    {/* Term & Store Links */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : k.id)}
                          className="font-semibold text-foreground text-sm tracking-tight hover:text-accent cursor-pointer transition-colors text-left"
                          title="Click to toggle rank history chart"
                        >
                          {k.term}
                        </button>
                        <div className="inline-flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                          <a
                            href={appStoreSearchUrl(k.term, k.country)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search in App Store"
                            className="text-muted hover:text-accent p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SiAppstore className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={playStoreSearchUrl(k.term)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search in Google Play"
                            className="text-muted hover:text-accent p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SiGoogleplay className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Popularity */}
                    <td className="py-2.5 px-3">
                      <PopularityBadge volume={k.volume} />
                    </td>

                    {/* Difficulty */}
                    <td className="py-2.5 px-3">
                      <DifficultyBadge difficulty={k.difficulty} />
                    </td>

                    {/* Effectiveness */}
                    <td className="py-2.5 px-3">
                      <EffectivenessBadge volume={k.volume} difficulty={k.difficulty} />
                    </td>

                    {/* Rank */}
                    <td className="py-2.5 px-3">
                      <RankBadge rank={latest} />
                    </td>

                    {/* Change */}
                    <td className="py-2.5 px-3">
                      <ChangeDeltaBadge latest={latest} previous={previous} />
                    </td>

                    {/* Best Rank */}
                    <td className="py-2.5 px-3">
                      <BestRankBadge ranks={k.ranks as RankEntry[]} />
                    </td>

                    {/* Apps Count */}
                    <td className="py-2.5 px-3 text-right">
                      <AppsCountBadge count={k.appsCount} />
                    </td>

                    {/* Trend Sparkline + Expand History */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : k.id)}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-background border border-transparent hover:border-border transition-all"
                          aria-expanded={isOpen}
                          title="View ranking history chart"
                        >
                          <RankSparkline positions={chronological.map((r) => r.position)} />
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${
                              isOpen ? "rotate-180 text-accent" : ""
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSingle(k.id);
                          }}
                          title="Stop tracking keyword"
                          className="text-muted hover:text-rose-400 p-1 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable History Chart */}
                  {isOpen && (
                    <tr className="border-b border-border/80 bg-background/50">
                      <td colSpan={9} className="p-3 sm:p-4">
                        <div className="rounded-lg border border-border/60 bg-card/70 p-4 shadow-xs">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-sm">
                                &ldquo;{k.term}&rdquo;
                              </span>
                              <span className="rounded bg-border/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                                {country.toUpperCase()}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs text-muted ml-2">
                                <span className="text-[11px] uppercase tracking-wide opacity-70">
                                  Current:
                                </span>
                                <RankBadge rank={latest} />
                                {previous !== null && (
                                  <ChangeDeltaBadge latest={latest} previous={previous} />
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-muted">
                              {k.ranks.length} check{k.ranks.length === 1 ? "" : "s"} recorded
                            </div>
                          </div>
                          <RankHistoryChart ranks={k.ranks} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
