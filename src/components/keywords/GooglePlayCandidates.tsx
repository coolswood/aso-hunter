import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { SiGoogleplay } from "react-icons/si";

interface Candidate {
  term: string;
  acquisitions: number;
  visitors: number;
  conversionRate: number;
  lastSeenDate: string;
}

export default function GooglePlayCandidates({
  appId,
  country,
  onKeywordsAdded,
}: {
  appId: string;
  country: string;
  onKeywordsAdded?: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [addingTerm, setAddingTerm] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/google-play/candidates?minAcquisitions=1`);
      if (!res.ok) throw new Error("Failed to load Google Play search term candidates");
      const data = (await res.json()) as { candidates: Candidate[] };
      setCandidates(data.candidates ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/google-play/sync`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to sync Google Play reports");
      }
      await loadCandidates();
      onKeywordsAdded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function addCandidate(term: string) {
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
        throw new Error((err as { error?: string }).error ?? "Failed to add keyword");
      }
      setCandidates((prev) => prev.filter((c) => c.term !== term));
      onKeywordsAdded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingTerm(null);
    }
  }

  async function addAllCandidates() {
    if (candidates.length === 0) return;
    setAddingAll(true);
    setError(null);
    try {
      const terms = candidates.map((c) => c.term);
      const res = await fetch(`/api/apps/${appId}/keywords/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms, country }),
      });
      if (!res.ok) throw new Error("Failed to bulk add candidates");
      setCandidates([]);
      onKeywordsAdded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddingAll(false);
    }
  }

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  if (candidates.length === 0 && !loading && !syncing) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <SiGoogleplay className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Google Play Search Discovery
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  <Sparkles className="h-3 w-3" />
                  {candidates.length} new
                </span>
              </h3>
            </div>
            <p className="text-xs text-muted">
              Search queries from your Google Play Console with verified installations not yet in
              your tracker.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-accent/10 transition-colors disabled:opacity-50 cursor-pointer"
            title="Download latest reports from Google Cloud Storage"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Reports"}
          </button>

          {candidates.length > 0 && (
            <button
              type="button"
              onClick={addAllCandidates}
              disabled={addingAll || syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {addingAll ? "Adding..." : `Track All (${candidates.length})`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          Loading Google Play search suggestions...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {candidates.map((c) => {
            const isAdding = addingTerm === c.term;
            return (
              <div
                key={c.term}
                className="group inline-flex items-center gap-2 rounded-lg border border-border/80 bg-card/80 hover:border-emerald-500/40 px-3 py-1.5 text-xs transition-all shadow-xs"
              >
                <span className="font-semibold text-foreground">&ldquo;{c.term}&rdquo;</span>
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-mono text-emerald-400 font-semibold"
                  title={`${c.visitors.toLocaleString()} visitors, ${(c.conversionRate * 100).toFixed(1)}% conversion`}
                >
                  <TrendingUp className="h-3 w-3" />+{c.acquisitions.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted font-mono">
                  {(c.conversionRate * 100).toFixed(1)}% CVR
                </span>
                <button
                  type="button"
                  onClick={() => addCandidate(c.term)}
                  disabled={isAdding || addingAll}
                  className="ml-1 inline-flex items-center justify-center rounded p-0.5 text-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Add to tracking"
                >
                  <Plus className={`h-3.5 w-3.5 ${isAdding ? "animate-spin" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
