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

const RANGES = [7, 14, 30] as const;

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
      grid: { top: 12, right: 12, left: 4, bottom: 4, containLabel: true },
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
          lineStyle: { color: theme.accent, width: 2.5 },
          itemStyle: { color: theme.accent },
          areaStyle: {
            color: theme.accent,
            opacity: 0.12,
          },
        },
      ],
    };
  }, [data, theme]);

  const knownPositions = data.map((d) => d.position).filter((p): p is number => p !== null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Rank history trajectory</span>
        <div className="inline-flex rounded-lg border border-border/70 p-0.5 bg-background/50">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {r}D
            </button>
          ))}
        </div>
      </div>

      {knownPositions.length < 2 ? (
        <div className="py-8 text-center text-xs text-muted">
          {knownPositions.length === 0
            ? "No ranks found yet for this keyword."
            : "Only 1 rank check recorded so far. Subsequent checks will form the trend line."}
        </div>
      ) : (
        <EChart
          option={option}
          height={200}
          ariaLabel="Line chart of the keyword's search rank over time"
        />
      )}
    </div>
  );
}
