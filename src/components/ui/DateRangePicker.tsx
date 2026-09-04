import { useEffect, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

export interface DateRangePickerValue {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  minDate?: string;
  maxDate?: string;
  onChange: (range: DateRangePickerValue) => void;
  onClear?: () => void;
}

const PRESETS = [
  { id: "7d", label: "Last 7 Days", days: 7 },
  { id: "30d", label: "Last 30 Days", days: 30 },
  { id: "90d", label: "Last 90 Days", days: 90 },
  { id: "180d", label: "Last 6 Months", days: 180 },
  { id: "365d", label: "Last 1 Year", days: 365 },
  { id: "all", label: "All Time", days: 0 },
] as const;

function parseRange(startDate?: string, endDate?: string): DateRange | undefined {
  const from = startDate ? parseISO(startDate) : undefined;
  const to = endDate ? parseISO(endDate) : undefined;
  if (from && isValid(from)) {
    return { from, to: to && isValid(to) ? to : from };
  }
  return undefined;
}

export default function DateRangePicker({
  startDate,
  endDate,
  minDate,
  maxDate,
  onChange,
  onClear,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() =>
    parseRange(startDate, endDate),
  );

  // Sync with prop changes
  useEffect(() => {
    setSelectedRange(parseRange(startDate, endDate));
  }, [startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const maxBound = maxDate && isValid(parseISO(maxDate)) ? parseISO(maxDate) : new Date();
  const minBound = minDate && isValid(parseISO(minDate)) ? parseISO(minDate) : undefined;

  function handleSelectRange(range: DateRange | undefined) {
    setSelectedRange(range);
    if (range?.from && range?.to) {
      const startStr = format(range.from, "yyyy-MM-dd");
      const endStr = format(range.to, "yyyy-MM-dd");
      onChange({ startDate: startStr, endDate: endStr });
      setIsOpen(false);
    }
  }

  function applyPreset(days: number) {
    if (days === 0) {
      // All time
      onClear?.();
      setSelectedRange(undefined);
      setIsOpen(false);
      return;
    }
    const end = maxBound;
    const start = new Date(end);
    start.setDate(end.getDate() - days);

    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    setSelectedRange({ from: start, to: end });
    onChange({ startDate: startStr, endDate: endStr });
    setIsOpen(false);
  }

  // Format label for button
  const displayLabel = () => {
    if (startDate && endDate) {
      const from = parseISO(startDate);
      const to = parseISO(endDate);
      if (isValid(from) && isValid(to)) {
        return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
      }
    }
    if (startDate) {
      const from = parseISO(startDate);
      if (isValid(from)) return `From ${format(from, "MMM d, yyyy")}`;
    }
    return "All Time (Select interval)";
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 text-xs text-foreground hover:border-accent/50 transition-all shadow-xs">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 cursor-pointer outline-none font-medium"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-muted shrink-0" />
          <span>{displayLabel()}</span>
          <ChevronDown
            className={`h-3 w-3 text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180 text-accent" : ""
            }`}
          />
        </button>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
              setSelectedRange(undefined);
            }}
            title="Clear date filter"
            className="ml-1 p-0.5 text-muted hover:text-foreground rounded transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md p-4 shadow-xl animate-in fade-in-0 zoom-in-95 flex flex-col sm:flex-row gap-4">
          {/* Quick Presets Sidebar */}
          <div className="flex flex-col gap-1 border-b sm:border-b-0 sm:border-r border-border/60 pb-3 sm:pb-0 sm:pr-3 min-w-[120px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
              Presets
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="text-left rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-accent/10 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendar Picker */}
          <div className="rdp-theme-dark">
            <style>{`
              .rdp-theme-dark {
                --rdp-accent-color: var(--color-accent, #6366f1);
                --rdp-accent-background-color: rgba(99, 102, 241, 0.15);
                --rdp-range_middle-background-color: rgba(99, 102, 241, 0.15);
                --rdp-range_middle-color: #f1f5f9;
                --rdp-range_start-date-background-color: var(--color-accent, #6366f1);
                --rdp-range_start-color: #ffffff;
                --rdp-range_end-date-background-color: var(--color-accent, #6366f1);
                --rdp-range_end-color: #ffffff;
                --rdp-day-height: 34px;
                --rdp-day-width: 34px;
                --rdp-day_button-height: 32px;
                --rdp-day_button-width: 32px;
              }
              .rdp-theme-dark .rdp-root {
                color: #f1f5f9;
                font-size: 0.825rem;
              }
              .rdp-theme-dark .rdp-day_button {
                color: inherit;
                font-size: 0.8rem;
              }
              .rdp-theme-dark .rdp-day_button:hover {
                background-color: rgba(255, 255, 255, 0.08);
              }
              .rdp-theme-dark .rdp-caption_label {
                font-size: 0.85rem;
                font-weight: 600;
              }
              .rdp-theme-dark .rdp-nav_button {
                color: #94a3b8;
              }
              .rdp-theme-dark .rdp-nav_button:hover {
                color: #f1f5f9;
                background-color: rgba(255, 255, 255, 0.08);
              }
            `}</style>
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={handleSelectRange}
              defaultMonth={selectedRange?.to ?? maxBound}
              startMonth={minBound}
              endMonth={maxBound}
              disabled={[{ after: maxBound }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
