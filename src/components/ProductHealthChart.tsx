"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { EChart, shellTooltip, tooltipRow, tooltipTitle, useChartTheme } from "./charts";
import type { ChartOption, TopLevelFormatterParams } from "./charts";

interface ProductHealthPoint {
  date: string;
  dau: number | null;
  healthScore: number | null;
}

interface ChartPoint {
  xLabel: string;
  dateLabel: string;
  dau: number | null;
  healthScore: number | null;
}

export default function ProductHealthChart({ appId }: { appId: string }) {
  const [trend, setTrend] = useState<ProductHealthPoint[] | null | undefined>(undefined);
  const theme = useChartTheme();

  useEffect(() => {
    function load() {
      fetch(`/api/apps/${appId}/product-health`)
        .then((res) => res.json())
        .then((data) => setTrend(data.trend))
        .catch(() => setTrend(null));
    }
    load();

    // AppTabs mounts every tab's content up front (just hides inactive ones),
    // so this chart fetches once on initial page load - typically before
    // PostHog gets connected in the Settings tab of the same page. Without
    // this, connecting only takes effect after a full page reload.
    function onPostHogStatusChange(e: Event) {
      if ((e as CustomEvent<{ appId: string }>).detail?.appId === appId) load();
    }
    window.addEventListener("posthog-status-change", onPostHogStatusChange);
    return () => window.removeEventListener("posthog-status-change", onPostHogStatusChange);
  }, [appId]);

  const data = useMemo<ChartPoint[]>(
    () =>
      (trend ?? []).map((p) => {
        const date = new Date(p.date);
        return {
          xLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          dateLabel: date.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          dau: p.dau,
          healthScore: p.healthScore,
        };
      }),
    [trend],
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
          return (
            tooltipTitle(point.dateLabel, theme) +
            `<div style="margin-top: 6px">` +
            tooltipRow(
              "Daily active users",
              point.dau != null ? String(point.dau) : "—",
              theme,
              theme.accent,
            ) +
            tooltipRow(
              "Health score",
              point.healthScore != null ? String(point.healthScore) : "—",
              theme,
              theme.success,
            ) +
            `</div>`
          );
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
      yAxis: [
        {
          type: "value",
          minInterval: 1,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: theme.muted, fontSize: 11 },
          splitLine: { lineStyle: { color: theme.border, type: [3, 3] } },
        },
        {
          type: "value",
          min: 0,
          max: 100,
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: theme.muted, fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          type: "line",
          id: "dau",
          name: "Daily active users",
          yAxisIndex: 0,
          data: data.map((d) => d.dau),
          showSymbol: false,
          symbolSize: 8,
          smooth: true,
          connectNulls: true,
          lineStyle: { color: theme.accent, width: 2 },
          itemStyle: { color: theme.accent },
        },
        {
          type: "line",
          id: "health",
          name: "Health score",
          yAxisIndex: 1,
          data: data.map((d) => d.healthScore),
          showSymbol: false,
          symbolSize: 8,
          smooth: true,
          connectNulls: true,
          lineStyle: { color: theme.success, width: 2 },
          itemStyle: { color: theme.success },
        },
      ],
    };
  }, [data, theme]);

  if (trend === undefined) {
    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6">
        <div className="h-[220px] rounded-lg bg-border animate-pulse" />
      </div>
    );
  }

  if (trend === null) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border/50">
          <Activity className="h-5 w-5 text-muted" />
        </div>
        <div className="text-sm text-muted">
          Connect a PostHog project in Settings to see real usage next to your ASO health score.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">Product health vs. ASO health</div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
            Daily active users
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
            Health score
          </span>
        </div>
      </div>
      <EChart
        option={option}
        height={220}
        ariaLabel="Line chart of daily active users versus ASO health score over time"
      />
    </div>
  );
}
