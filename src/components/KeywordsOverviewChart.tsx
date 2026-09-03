"use client";

import { useMemo, useState } from "react";
import { EChart, shellTooltip, tooltipTitle, useChartTheme } from "./charts";
import type { ChartOption, TopLevelFormatterParams } from "./charts";
import type { ChartTheme } from "./charts";

interface KeywordRankSeries {
  id: string;
  term: string;
  ranks: { position: number | null; checkedAt: string | Date }[];
}

const RANGES = [7, 30] as const;
const MAX_SERIES = 8;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface ChartDate {
  key: string;
  xLabel: string;
  dateLabel: string;
}

/** One keyword's tooltip row: color dot, term, best-first rank value. */
function tooltipKeywordRow(color: string, term: string, value: string, theme: ChartTheme): string {
  return (
    `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">` +
    `<span style="display: flex; min-width: 0; align-items: center; gap: 6px">` +
    `<span style="width: 6px; height: 6px; border-radius: 9999px; flex-shrink: 0; background: ${color}"></span>` +
    `<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${term}</span>` +
    `</span>` +
    `<span style="flex-shrink: 0; font-weight: 600; font-variant-numeric: tabular-nums; color: ${theme.foreground}">${value}</span>` +
    `</div>`
  );
}

/** Legend doubles as the "which keyword is which color" key (required
 * whenever >=2 series are on screen) and a click-to-toggle filter - since
 * only up to MAX_SERIES lines are plotted at once, hiding a couple frees up
 * visual room without needing a second chart. */
function CustomLegend({
  shown,
  colorById,
  hidden,
  onToggle,
}: {
  shown: KeywordRankSeries[];
  colorById: Map<string, string>;
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-3">
      {shown.map((k) => {
        const isHidden = hidden.has(k.id);
        return (
          <button
            key={k.id}
            onClick={() => onToggle(k.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs transition-colors hover:border-accent ${
              isHidden ? "text-muted opacity-50" : "text-foreground"
            }`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: isHidden ? "var(--border)" : colorById.get(k.id) }}
            />
            {k.term}
          </button>
        );
      })}
    </div>
  );
}

export default function KeywordsOverviewChart({ keywords }: { keywords: KeywordRankSeries[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const theme = useChartTheme();

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const withPositions = useMemo(
    () => keywords.filter((k) => k.ranks.some((r) => r.position !== null)),
    [keywords],
  );

  // Best (lowest = closest to #1) latest position first - the most relevant
  // keywords to compare, and the natural cutoff when there are more tracked
  // keywords than the 8-color budget allows plotting at once.
  const shown = useMemo(() => {
    return [...withPositions]
      .sort((a, b) => {
        const la = a.ranks[0]?.position ?? Infinity;
        const lb = b.ranks[0]?.position ?? Infinity;
        return la - lb;
      })
      .slice(0, MAX_SERIES);
  }, [withPositions]);

  // Fixed palette slot order (globals.css --series-1..8, resolved to concrete
  // colors for canvas) - validated (dataviz skill) for CVD-safe adjacent
  // separation and contrast against this app's --card surface. Never
  // reassigned per filter/selection; a 9th keyword never gets a generated
  // color, see MAX_SERIES.
  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    shown.forEach((k, i) => map.set(k.id, theme.series[i]));
    return map;
  }, [shown, theme]);

  // Union of all shown series' dates, chronological, with each series'
  // (possibly sparse) values aligned to it.
  const dates = useMemo<ChartDate[]>(() => {
    const byDate = new Map<string, ChartDate>();
    for (const k of shown) {
      for (const r of [...k.ranks].reverse().slice(-range)) {
        const date = new Date(r.checkedAt);
        const key = dateKey(date);
        if (!byDate.has(key)) {
          byDate.set(key, {
            key,
            xLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            dateLabel: date.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
          });
        }
      }
    }
    return Array.from(byDate.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [shown, range]);

  const option = useMemo<ChartOption>(() => {
    const series = shown
      .filter((k) => !hidden.has(k.id))
      .map((k) => {
        const valuesByDate = new Map<string, number | null>();
        for (const r of [...k.ranks].reverse().slice(-range)) {
          valuesByDate.set(dateKey(new Date(r.checkedAt)), r.position);
        }
        return {
          type: "line" as const,
          id: k.id,
          name: k.term,
          data: dates.map((d) => valuesByDate.get(d.key) ?? null),
          showSymbol: false,
          symbolSize: 8,
          connectNulls: true,
          lineStyle: { color: colorById.get(k.id), width: 2 },
          itemStyle: { color: colorById.get(k.id) },
        };
      });

    return {
      grid: { top: 8, right: 8, left: 0, bottom: 0, containLabel: true },
      tooltip: {
        ...shellTooltip(theme, "max-width: 220px;"),
        trigger: "axis",
        confine: true,
        axisPointer: { type: "line", lineStyle: { color: theme.border } },
        formatter: (params: TopLevelFormatterParams) => {
          const list = Array.isArray(params) ? params : [params];
          const date = list[0] ? dates[list[0].dataIndex] : undefined;
          if (!date) return "";
          // Best (lowest) rank first; series without a value that day drop out.
          const rows = list
            .flatMap((p) =>
              typeof p.value === "number" && typeof p.color === "string"
                ? [{ color: p.color, name: String(p.seriesName), value: p.value }]
                : [],
            )
            .sort((a, b) => a.value - b.value)
            .map((r) => tooltipKeywordRow(r.color, r.name, `#${r.value}`, theme));
          if (rows.length === 0) return "";
          return (
            tooltipTitle(date.dateLabel, theme) +
            `<div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px">` +
            rows.join("") +
            `</div>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: dates.map((d) => d.xLabel),
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        // Rank #1 must sit on top of the axis.
        inverse: true,
        minInterval: 1,
        min: (value: { min: number; max: number }) => Math.max(1, Math.floor(value.min) - 1),
        max: (value: { min: number; max: number }) => Math.ceil(value.max) + 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.border, type: [3, 3] } },
      },
      series,
    };
  }, [shown, hidden, dates, range, colorById, theme]);

  const knownPositions = shown.flatMap((k) =>
    k.ranks.map((r) => r.position).filter((p): p is number => p !== null),
  );
  const omitted = withPositions.length - shown.length;

  if (withPositions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">All keywords - rank history</div>
          {omitted > 0 && (
            <div className="text-xs text-muted">
              Showing the {shown.length} best-ranked of {withPositions.length} tracked keywords.
            </div>
          )}
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {knownPositions.length < 2 ? (
        <div className="py-10 text-center text-sm text-muted">Not enough history yet.</div>
      ) : (
        <EChart
          option={option}
          height={260}
          ariaLabel="Line chart of tracked keywords' search ranks over time"
        />
      )}

      <CustomLegend shown={shown} colorById={colorById} hidden={hidden} onToggle={toggle} />
    </div>
  );
}
