/**
 * Pure helper function to parse raw text containing keywords separated by
 * newlines or commas, deduplicate them, and filter out already tracked terms.
 */
export function parseBulkKeywords(
  input: string,
  existingTerms: Set<string> | string[],
): {
  newTerms: string[];
  ignoredTerms: string[];
  totalParsed: number;
} {
  const existingSet =
    existingTerms instanceof Set
      ? existingTerms
      : new Set(existingTerms.map((t) => t.trim().toLowerCase()));

  // Split on commas, newlines (\n, \r\n, \r)
  const rawParts = input.split(/[,\n\r]+/);
  const seenInInput = new Set<string>();
  const newTerms: string[] = [];
  const ignoredTerms: string[] = [];

  for (const part of rawParts) {
    const term = part.trim();
    if (!term) continue;
    const lower = term.toLowerCase();
    if (seenInInput.has(lower)) continue;
    seenInInput.add(lower);

    if (existingSet.has(lower)) {
      ignoredTerms.push(term);
    } else {
      newTerms.push(term);
    }
  }

  return {
    newTerms,
    ignoredTerms,
    totalParsed: seenInInput.size,
  };
}
