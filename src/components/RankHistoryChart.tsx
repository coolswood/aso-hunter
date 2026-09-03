"use client";

import { useMemo, useState } from "react";
import { EChart, shellTooltip, tooltipRow, tooltipTitle, useChartTheme } from "./charts";
import type { ChartOption, TopLevelFormatterParams } from "./charts";

interface RankPoint {
  position: number | null;
  checkedAt: string | Date;
}

interface ChartPoint {
  xLabel: string;
  dateLabel: string;
  position: number | null;
  change: number | null;
}

const RANGES = [7, 30] as const;

export default function RankHistoryChart({ ranks }: { ranks: RankPoint[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const theme = useChartTheme();

  // ranks arrives newest-first (matches the table); the chart reads
  // left-to-right chronologically.
  const chronological = useMemo(() => [...ranks].reverse(), [ranks]);
  const sliced = useMemo(() => chronological.slice(-range), [chronological, range]);

  const data = useMemo<ChartPoint[]>(
    () =>
      sliced.map((r, i) => {
        const prev = sliced[i - 1];
        const change =
          r.position !== null && prev?.position != null ? prev.position - r.position : null;
        const date = new Date(r.checkedAt);
        return {
          xLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          dateLabel: date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          position: r.position,
          change,
        };
      }),
    [sliced],
  );

  const option = useMemo<ChartOption>(() => {
    return {
      grid: { top: 8, right: 8, left: 0, bottom: 0, containLabel: true },
      tooltip: {
        ...shellTooltip(theme),
        trigger: "axis",
        confine: true,
        axisPointer: { type: "line", lineStyle: { color: theme.border } },
        formatter: (params: TopLevelFormatterParams) => {
          const first = Array.isArray(params) ? params[0] : params;
          const point = first ? data[first.dataIndex] : undefined;
          if (!point) return "";
          let html =
            tooltipTitle(point.dateLabel, theme) +
            `<div style="margin-top: 6px">` +
            tooltipRow(
              "Rank",
              point.position !== null ? `#${point.position}` : "Not ranked",
              theme,
            );
          if (point.change !== null && point.change !== 0) {
            html += tooltipRow(
              "Change",
              point.change > 0 ? `+${point.change}` : String(point.change),
              theme,
              point.change > 0 ? theme.success : theme.danger,
            );
          }
          return html + `</div>`;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.xLabel),
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
      series: [
        {
          type: "line",
          id: "position",
          data: data.map((d) => d.position),
          showSymbol: true,
          symbol: "circle",
          symbolSize: 6,
          smooth: true,
          connectNulls: true,
          lineStyle: { color: theme.accent, width: 2 },
          itemStyle: { color: theme.accent },
        },
      ],
    };
  }, [data, theme]);

  const knownPositions = data.map((d) => d.position).filter((p): p is number => p !== null);

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Rank history</div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
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
          height={220}
          ariaLabel="Line chart of the keyword's search rank over time"
        />
      )}
    </div>
  );
}
