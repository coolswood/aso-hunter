import { Fragment, useMemo, useState } from "react";
import { ArrowUpDown, Check, ChevronDown, Copy, RefreshCw, Trash2 } from "lucide-react";
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
  onCopyKeywords,
}: {
  appId: string;
  platform: StorePlatform;
  country: string;
  keywords: KeywordWithRanks[];
  onChanged?: () => void;
  onCopyKeywords?: (terms: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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

  // Selection handlers
  const allSelected = keywords.length > 0 && selectedIds.size === keywords.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < keywords.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keywords.map((k) => k.id)));
    }
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    setDeletingBulk(true);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        onChanged?.();
      }
    } finally {
      setDeletingBulk(false);
    }
  }

  async function removeSingle(keywordId: string) {
    await fetch(`/api/apps/${appId}/keywords/${keywordId}`, { method: "DELETE" });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(keywordId);
      return next;
    });
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

  function handleCopySelected() {
    const selectedTerms = keywords.filter((k) => selectedIds.has(k.id)).map((k) => k.term);

    if (selectedTerms.length > 0) {
      onCopyKeywords?.(selectedTerms);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  }

  return (
    <div className="space-y-3">
      {/* Top action bar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {selectedIds.size} of {keywords.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySelected}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Copy selected keywords for App Store Connect"
            >
              {copySuccess ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copySuccess ? "Copied!" : "Copy selected"}
            </button>
            <button
              onClick={deleteSelected}
              disabled={deletingBulk}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingBulk ? "Deleting..." : "Delete selected"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted hover:text-foreground px-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Keywords Table */}
      <div className="rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-xs overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[840px]">
          <thead>
            <tr className="border-b border-border/80 text-[11px] font-semibold tracking-wider text-muted uppercase select-none">
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={toggleSelectAll}
                  aria-label="Select all keywords"
                  className="h-4 w-4 rounded border-border bg-card accent-accent cursor-pointer transition-colors"
                />
              </th>
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
              const isSelected = selectedIds.has(k.id);

              return (
                <Fragment key={k.id}>
                  <tr
                    className={`transition-colors select-none ${
                      isSelected
                        ? "bg-emerald-950/20 hover:bg-emerald-950/30"
                        : "hover:bg-background/60"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}
                  >
                    {/* Checkbox */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(k.id)}
                        aria-label={`Select keyword ${k.term}`}
                        className="h-4 w-4 rounded border-border bg-card accent-accent cursor-pointer"
                      />
                    </td>

                    {/* Term & Store Links */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm tracking-tight hover:text-accent cursor-pointer transition-colors">
                          {k.term}
                        </span>
                        <div className="inline-flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                          <a
                            href={appStoreSearchUrl(k.term, k.country)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search in App Store"
                            className="text-muted hover:text-accent p-0.5"
                          >
                            <SiAppstore className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={playStoreSearchUrl(k.term)}
                            target="_blank"
                            rel="noreferrer"
                            title="Search in Google Play"
                            className="text-muted hover:text-accent p-0.5"
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
                          onClick={() => setExpanded(isOpen ? null : k.id)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-background transition-colors"
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
                          onClick={() => removeSingle(k.id)}
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
                      <td colSpan={10} className="p-4">
                        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
                          <div className="mb-2 flex items-center justify-between text-xs text-muted">
                            <span className="font-semibold text-foreground">
                              Rank History for &ldquo;{k.term}&rdquo; ({country.toUpperCase()})
                            </span>
                            <span className="text-[11px]">Last 30 checks</span>
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
