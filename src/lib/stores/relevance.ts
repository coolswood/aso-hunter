/**
 * Pure relevance/authority helpers shared by the store adapters' analyzeTerm.
 * No network or DB imports - keeps them testable and client-safe.
 */

/** Splits text into lowercase word tokens (Unicode-aware: works for Cyrillic,
 * CJK-free scripts, digits). Punctuation/hyphens act as separators. */
export function tokenizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
}

/** True when every query word appears in the listing title as a whole word.
 * Substring matching made "ai" match "rain"/"hair" and inflated the relevant
 * result count, which inflated volume/density scores. */
export function titleMatchesAllWords(title: string | null | undefined, words: string[]): boolean {
  if (!title || words.length === 0) return false;
  const titleWords = tokenizeWords(title);
  return words.every((w) => titleWords.has(w.toLowerCase()));
}

/** Middle value of the list. Unlike the mean, one giant competitor can't drag
 * it up, so the authority of the apps you compete with isn't dominated by a
 * single whale (e.g. WhatsApp next to nine niche tools). Returns 0 for an
 * empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return hi;
  const lo = sorted[mid - 1] ?? 0;
  return (lo + hi) / 2;
}
