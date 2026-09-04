import { useRef, useState } from "react";
import { Copy, Sparkles, Tags } from "lucide-react";
import KeywordsOverviewChart from "./KeywordsOverviewChart";
import KeywordTable, { type KeywordWithRanks } from "./keywords/KeywordTable";
import type { StorePlatform } from "@/lib/stores/types";

// Apple's App Store Connect "Keywords" field is a single comma-separated
// string capped at 100 characters (per locale) - Google Play has no
// equivalent discrete field (Play's algorithm infers relevance from the
// title/description text itself), so only iOS needs the fit-as-many-as-
// possible packing below.
const APPLE_KEYWORDS_LIMIT = 100;

interface KeywordField {
  text: string;
  includedCount: number;
  omittedCount: number;
}

/** Greedily fits as many terms as possible into `limit` chars (comma-joined,
 * no spaces, to match App Store Connect convention and save budget) rather
 * than truncating in order - a later short keyword that still fits shouldn't
 * be dropped just because an earlier long one didn't. */
function buildKeywordField(terms: string[], limit?: number): KeywordField {
  const unique = Array.from(new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean)));
  if (!limit) {
    return { text: unique.join(","), includedCount: unique.length, omittedCount: 0 };
  }

  const included: string[] = [];
  let length = 0;
  for (const term of unique) {
    const nextLength = included.length === 0 ? term.length : length + 1 + term.length;
    if (nextLength > limit) continue;
    included.push(term);
    length = nextLength;
  }
  return {
    text: included.join(","),
    includedCount: included.length,
    omittedCount: unique.length - included.length,
  };
}

export default function KeywordsSection({
  appId,
  platform,
  country,
  keywords,
  onChanged,
}: {
  appId: string;
  platform: StorePlatform;
  /** Storefront resolved by the global selector - new keywords are tracked
   * in it, and `keywords` arrive pre-filtered to it by the server. */
  country: string;
  keywords: KeywordWithRanks[];
  /** Re-fetches the app after keyword mutations */
  onChanged?: () => void;
}) {
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyKeywords(termsToCopy?: string[]) {
    const terms = termsToCopy ?? keywords.map((k) => k.term);
    const limit = platform === "IOS" ? APPLE_KEYWORDS_LIMIT : undefined;
    const field = buildKeywordField(terms, limit);
    try {
      await navigator.clipboard.writeText(field.text);
      setCopyStatus(
        field.omittedCount > 0
          ? `Copied ${field.includedCount} keywords (${field.text.length}/${limit} chars, ${field.omittedCount} left out)`
          : `Copied ${field.includedCount} keyword${field.includedCount === 1 ? "" : "s"}${limit ? ` (${field.text.length}/${limit} chars)` : ""}`,
      );
    } catch {
      setCopyStatus("Couldn't copy - clipboard access denied");
    } finally {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyStatus(null), 4000);
    }
  }

  async function autoDetect() {
    setDetecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords/auto-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      if (!res.ok) throw new Error("Failed to auto-detect keywords");
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetecting(false);
    }
  }

  async function addKeyword() {
    if (!term.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add keyword");
      setTerm("");
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          placeholder="Add a keyword to track..."
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors focus:border-accent"
        />
        <button
          onClick={addKeyword}
          disabled={adding}
          title={`Track the keyword in the ${country} storefront (switch the market in the header above)`}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-transform"
        >
          {adding ? "Adding..." : "Track"}
        </button>
        <button
          onClick={autoDetect}
          disabled={detecting}
          title={detecting ? "Detecting..." : "Auto-detect keywords from your title and subtitle"}
          aria-label="Auto-detect keywords"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 hover:bg-card hover:border-accent disabled:opacity-50 transition-colors"
        >
          <Sparkles className={`h-3.5 w-3.5 ${detecting ? "animate-pulse" : ""}`} />
        </button>
        {keywords.length > 0 && (
          <button
            onClick={() => copyKeywords()}
            title={
              platform === "IOS"
                ? "Copy for App Store: joins every tracked keyword into one comma-separated list, packed to fit the App Store Connect Keywords field's 100-character limit, and copies it."
                : "Copy keywords: joins every tracked keyword into one comma-separated list and copies it."
            }
            aria-label="Copy keywords"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 hover:bg-card hover:border-accent transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {copyStatus && <div className="text-xs text-muted animate-fade-in-up">{copyStatus}</div>}
      {error && <div className="text-sm text-rose-500 animate-fade-in-up">{error}</div>}

      {keywords.length > 1 && (
        <div className="animate-fade-in-up">
          <KeywordsOverviewChart keywords={keywords} />
        </div>
      )}

      {keywords.length === 0 ? (
        <div className="animate-fade-in-up flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
            <Tags className="h-5 w-5 text-muted" />
          </div>
          <div className="text-sm text-muted max-w-sm">
            No keywords tracked in this storefront yet. Add one above, or hit{" "}
            <button
              onClick={autoDetect}
              className="text-accent font-medium hover:underline"
              disabled={detecting}
            >
              Auto-detect
            </button>{" "}
            to pull candidates straight from your title and subtitle. Switch the market in the
            header to see other storefronts.
          </div>
        </div>
      ) : (
        <KeywordTable
          appId={appId}
          platform={platform}
          country={country}
          keywords={keywords}
          onChanged={onChanged}
          onCopyKeywords={copyKeywords}
        />
      )}
    </div>
  );
}
