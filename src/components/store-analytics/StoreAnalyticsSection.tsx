import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { SiGoogleplay } from "react-icons/si";
import DateRangePicker from "@/components/ui/DateRangePicker";

interface TermRow {
  term: string;
  acquisitions: number;
  visitors: number;
  conversionRate: number;
  firstSeenDate: string;
  lastSeenDate: string;
  isTracked: boolean;
  trackedCountries: string[];
}

interface SummaryData {
  totalAcquisitions: number;
  totalVisitors: number;
  overallConversionRate: number;
  uniqueTermsCount: number;
  minDate: string | null;
  maxDate: string | null;
}

type PresetPeriod = "30d" | "90d" | "180d" | "365d" | "all" | "custom";
type SortField = "term" | "acquisitions" | "visitors" | "conversionRate" | "lastSeenDate";
type SortOrder = "asc" | "desc";

export default function StoreAnalyticsSection({
  appId,
  country,
  onKeywordsChanged,
}: {
  appId: string;
  country: string;
  onKeywordsChanged?: () => void;
}) {
  const [preset, setPreset] = useState<PresetPeriod>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [addingTerm, setAddingTerm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("acquisitions");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const computeDatesForPreset = useCallback((p: PresetPeriod, maxDateStr?: string | null) => {
    if (p === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = maxDateStr ? new Date(maxDateStr) : new Date();
    const start = new Date(end);
    if (p === "30d") start.setDate(end.getDate() - 30);
    else if (p === "90d") start.setDate(end.getDate() - 90);
    else if (p === "180d") start.setDate(end.getDate() - 180);
    else if (p === "365d") start.setDate(end.getDate() - 365);

    const toIso = (d: Date) => d.toISOString().split("T")[0] ?? "";
    setStartDate(toIso(start));
    setEndDate(toIso(end));
  }, []);

  const fetchTerms = useCallback(
    async (start?: string, end?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
        const url = `/api/apps/${appId}/google-play/terms?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load Google Play search performance terms");
        const data = (await res.json()) as { summary: SummaryData; terms: TermRow[] };
        setSummary(data.summary);
        setTerms(data.terms ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [appId],
  );

  useEffect(() => {
    void fetchTerms(startDate, endDate);
  }, [fetchTerms, startDate, endDate]);

  function handlePresetChange(p: PresetPeriod) {
    setPreset(p);
    computeDatesForPreset(p, summary?.maxDate);
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/google-play/sync`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to sync Google Play reports");
      }
      await fetchTerms(startDate, endDate);
      onKeywordsChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function addTermToTracking(term: string) {
    setAddingTerm(term);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, country }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to track keyword");
      }
      // Optimistic update
      setTerms((prev) =>
        prev.map((t) =>
          t.term === term
            ? { ...t, isTracked: true, trackedCountries: [...t.trackedCountries, country] }
            : t,
        ),
      );
      onKeywordsChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingTerm(null);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "term" ? "asc" : "desc");
    }
  }

  const filteredAndSorted = useMemo(() => {
    let list = terms;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) => t.term.includes(q));
    }

    return [...list].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;
      switch (sortField) {
        case "term":
          valA = a.term.toLowerCase();
          valB = b.term.toLowerCase();
          break;
        case "acquisitions":
          valA = a.acquisitions;
          valB = b.acquisitions;
          break;
        case "visitors":
          valA = a.visitors;
          valB = b.visitors;
          break;
        case "conversionRate":
          valA = a.conversionRate;
          valB = b.conversionRate;
          break;
        case "lastSeenDate":
          valA = a.lastSeenDate;
          valB = b.lastSeenDate;
          break;
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [terms, searchQuery, sortField, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <SiGoogleplay className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              Google Play Organic Search Performance
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                <Sparkles className="h-3 w-3" />
                Live Cloud Reports
              </span>
            </h2>
            <p className="text-xs text-muted">
              Global search terms, listing visitors, and real acquisitions directly from your Google
              Play Console bucket.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing from Google Cloud..." : "Sync Reports"}
          </button>
        </div>
      </div>

      {/* Date Range & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card/40 border border-border/60 rounded-xl p-3">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {(
            [
              { id: "30d", label: "30 Days" },
              { id: "90d", label: "90 Days" },
              { id: "180d", label: "6 Months" },
              { id: "365d", label: "1 Year" },
              { id: "all", label: "All Time" },
            ] as const
          ).map((p) => {
            const isActive = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-muted hover:text-foreground hover:bg-background/80"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Calendar Pickers & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            minDate={summary?.minDate ?? undefined}
            maxDate={summary?.maxDate ?? undefined}
            onChange={(range) => {
              setPreset("custom");
              setStartDate(range.startDate);
              setEndDate(range.endDate);
            }}
            onClear={() => {
              setPreset("all");
              setStartDate("");
              setEndDate("");
            }}
          />

          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter search queries..."
              className="w-full rounded-lg border border-border/80 bg-background/80 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Acquisitions
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {summary ? `+${summary.totalAcquisitions.toLocaleString()}` : "—"}
          </div>
          <p className="text-[11px] text-muted mt-1">Direct search installations</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Listing Visitors</span>
            <Eye className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {summary ? summary.totalVisitors.toLocaleString() : "—"}
          </div>
          <p className="text-[11px] text-muted mt-1">Card impressions from search</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average CVR</span>
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {summary ? `${(summary.overallConversionRate * 100).toFixed(1)}%` : "—"}
          </div>
          <p className="text-[11px] text-muted mt-1">Acquisitions / Visitors</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Search Terms</span>
            <Users className="h-4 w-4 text-accent" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {summary ? summary.uniqueTermsCount.toLocaleString() : "—"}
          </div>
          <p className="text-[11px] text-muted mt-1">Unique query variants recorded</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/80 bg-card/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border/80 text-[11px] font-semibold tracking-wider text-muted uppercase select-none bg-background/50">
                <th
                  onClick={() => handleSort("term")}
                  className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>SEARCH TERM</span>
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortField === "term" ? "text-accent" : "opacity-40"}`}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("acquisitions")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors text-right"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>ACQUISITIONS</span>
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortField === "acquisitions" ? "text-accent" : "opacity-40"}`}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("visitors")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors text-right"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>VISITORS</span>
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortField === "visitors" ? "text-accent" : "opacity-40"}`}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("conversionRate")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors text-right"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>CVR (%)</span>
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortField === "conversionRate" ? "text-accent" : "opacity-40"}`}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("lastSeenDate")}
                  className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>LAST RECORDED</span>
                    <ArrowUpDown
                      className={`h-3 w-3 ${sortField === "lastSeenDate" ? "text-accent" : "opacity-40"}`}
                    />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">
                  <span>STATUS IN TRACKER</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && terms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-accent" />
                    Loading Google Play performance data...
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted">
                    No search terms found matching the current period or query.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((r) => {
                  const isAdding = addingTerm === r.term;
                  return (
                    <tr key={r.term} className="hover:bg-background/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground text-sm">
                        &ldquo;{r.term}&rdquo;
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                        +{r.acquisitions.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted text-xs">
                        {r.visitors.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs">
                        <span
                          className={`font-semibold ${
                            r.conversionRate >= 0.3
                              ? "text-emerald-400"
                              : r.conversionRate >= 0.15
                                ? "text-blue-400"
                                : "text-muted"
                          }`}
                        >
                          {(r.conversionRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted font-mono">
                        {r.lastSeenDate || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.isTracked ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-border/60 px-2.5 py-0.5 text-[11px] font-medium text-muted"
                            title={`Tracked in: ${r.trackedCountries.join(", ").toUpperCase()}`}
                          >
                            <Check className="h-3 w-3 text-emerald-400" />
                            Tracked ({r.trackedCountries.join(", ").toUpperCase()})
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addTermToTracking(r.term)}
                            disabled={isAdding}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                            title={`Add to tracking in storefront: ${country.toUpperCase()}`}
                          >
                            <Plus className={`h-3.5 w-3.5 ${isAdding ? "animate-spin" : ""}`} />
                            {isAdding ? "Adding..." : `+ Track in ${country.toUpperCase()}`}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
