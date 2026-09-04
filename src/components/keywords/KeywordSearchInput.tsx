import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { DifficultyBadge, PopularityBadge, RankBadge } from "./KeywordMetricBadges";

export interface SuggestionItem {
  term: string;
  rank: number | null;
  volume: number | null;
  difficulty: number | null;
  appsCount: number | null;
  isAlreadyTracked: boolean;
}

export default function KeywordSearchInput({
  appId,
  country,
  onAddKeyword,
  adding = false,
}: {
  appId: string;
  country: string;
  onAddKeyword: (term: string) => Promise<void> | void;
  adding?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [trackingTerm, setTrackingTerm] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions when term changes (debounced)
  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/apps/${appId}/keywords/suggestions?term=${encodeURIComponent(query)}&country=${country}`,
        );
        if (!res.ok) throw new Error("Failed to fetch suggestions");
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [term, appId, country]);

  async function handleSelect(selectedTerm: string) {
    if (!selectedTerm.trim()) return;
    setTrackingTerm(selectedTerm);
    try {
      await onAddKeyword(selectedTerm);
      setTerm("");
      setIsOpen(false);
      setSuggestions([]);
    } finally {
      setTrackingTerm(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter" && term.trim()) {
        handleSelect(term.trim());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelect(suggestions[activeIndex].term);
        } else if (term.trim()) {
          handleSelect(term.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Add a keyword to track or search suggestions..."
          disabled={adding}
          className="w-full rounded-lg border border-border bg-card pl-9 pr-8 py-2 text-sm transition-colors focus:border-accent focus:outline-hidden disabled:opacity-50"
        />
        {loading && (
          <div className="absolute right-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-muted" />
          </div>
        )}
        {!loading && term && (
          <button
            onClick={() => {
              setTerm("");
              setSuggestions([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Suggestions Popover */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-96 overflow-y-auto rounded-xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-md animate-fade-in-up">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase flex items-center justify-between border-b border-border/60 mb-1">
            <span>Store Suggestions &amp; Live Positions ({country.toUpperCase()})</span>
            <span className="text-[10px] font-normal lowercase text-muted">
              use &uarr;&darr; + enter
            </span>
          </div>

          <div className="space-y-0.5">
            {suggestions.map((item, idx) => {
              const isSelected = activeIndex === idx;
              const isTracking = trackingTerm === item.term;

              return (
                <div
                  key={item.term}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(item.term)}
                  className={`group flex items-center justify-between gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent/15 text-foreground"
                      : "hover:bg-background/80 text-foreground/90"
                  }`}
                >
                  {/* Keyword name & badges */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">{item.term}</span>
                    {item.isAlreadyTracked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-muted">
                        <Check className="h-3 w-3 text-emerald-400" />
                        Tracked
                      </span>
                    )}
                  </div>

                  {/* Metrics preview */}
                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    {/* Rank */}
                    <div
                      className="flex items-center gap-1"
                      title="Current app rank in store search"
                    >
                      <span className="text-[11px] text-muted">Rank:</span>
                      <RankBadge rank={item.rank} />
                    </div>

                    {/* Popularity */}
                    <div className="hidden sm:flex items-center gap-1.5" title="Search demand">
                      <span className="text-[11px] text-muted">Pop:</span>
                      <PopularityBadge volume={item.volume} />
                    </div>

                    {/* Difficulty */}
                    <div className="hidden md:flex items-center gap-1" title="Competition level">
                      <DifficultyBadge difficulty={item.difficulty} />
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      disabled={isTracking}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(item.term);
                      }}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                        item.isAlreadyTracked
                          ? "border border-border text-muted opacity-60 hover:opacity-100"
                          : "bg-accent text-accent-foreground shadow-xs hover:shadow-sm"
                      }`}
                    >
                      {isTracking ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : item.isAlreadyTracked ? (
                        "Sync"
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          Track
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
