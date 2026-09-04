"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ListPlus, Loader2, X } from "lucide-react";
import { parseBulkKeywords } from "@/lib/bulkKeywords";

export default function BulkAddKeywordsModal({
  isOpen,
  onClose,
  country,
  existingTerms,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  country: string;
  existingTerms: string[];
  onAdd: (terms: string[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setText("");
      setError(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, submitting, onClose]);

  const { newTerms, ignoredTerms, totalParsed } = useMemo(() => {
    return parseBulkKeywords(text, existingTerms);
  }, [text, existingTerms]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newTerms.length === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await onAdd(newTerms);
      setText("");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to add keywords");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] animate-fade-in backdrop-blur-xs"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <ListPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Bulk Add Keywords</h2>
              <p className="text-xs text-muted">
                Storefront:{" "}
                <span className="font-semibold uppercase text-foreground">
                  {country.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-muted hover:bg-border/50 hover:text-foreground disabled:opacity-50 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="bulk-keywords-input" className="text-xs font-medium text-foreground">
              Keywords List
            </label>
            <textarea
              id="bulk-keywords-input"
              ref={textareaRef}
              rows={7}
              disabled={submitting}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste phrases separated by new lines or commas, e.g.:&#10;sleep tracker&#10;meditation, mindfulness&#10;breathing exercises&#10;white noise"
              className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition-colors disabled:opacity-60"
            />
            <p className="text-[11px] text-muted">
              Commas or line breaks separate phrases. Case-insensitive; duplicate and already
              tracked keywords are skipped automatically.
            </p>
          </div>

          {/* Real-time stats summary */}
          {totalParsed > 0 && (
            <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {newTerms.length} new {newTerms.length === 1 ? "phrase" : "phrases"} to add
                </span>
                {ignoredTerms.length > 0 && (
                  <span className="inline-flex items-center rounded bg-border/60 px-2 py-0.5 text-muted">
                    {ignoredTerms.length} already tracked (will be skipped)
                  </span>
                )}
              </div>

              {/* Preview chips for new terms */}
              {newTerms.length > 0 && (
                <div className="max-h-24 overflow-y-auto pt-1 flex flex-wrap gap-1">
                  {newTerms.slice(0, 25).map((term) => (
                    <span
                      key={term}
                      className="inline-block rounded border border-border/80 bg-card px-2 py-0.5 text-[11px] text-foreground"
                    >
                      {term}
                    </span>
                  ))}
                  {newTerms.length > 25 && (
                    <span className="text-[11px] text-muted self-center">
                      +{newTerms.length - 25} more...
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <div className="text-xs text-rose-500 animate-fade-in">{error}</div>}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted hover:bg-card hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={newTerms.length === 0 || submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground shadow-xs hover:shadow-sm disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting
                ? "Adding..."
                : `Add ${newTerms.length} ${newTerms.length === 1 ? "keyword" : "keywords"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
