import { useMemo, useState } from "react";
import { Compass, ExternalLink, Flame, Info, Search } from "lucide-react";
import { EChart, shellTooltip, tooltipRow, tooltipTitle, useChartTheme } from "@/components/charts";
import type { ChartOption, TopLevelFormatterParams } from "@/components/charts";
import type { TrafficSourcesResult } from "@/lib/googlePlayReports";

interface TrafficSourcesChartProps {
  data: TrafficSourcesResult;
  startDate?: string;
  endDate?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  explore: "#818cf8", // Indigo 400
  search: "#34d399", // Emerald 400
  other: "#fbbf24", // Amber 400
};

function getSourceColor(sourceName: string): string {
  const lower = sourceName.toLowerCase();
  if (lower.includes("explore")) return SOURCE_COLORS.explore;
  if (lower.includes("search")) return SOURCE_COLORS.search;
  return SOURCE_COLORS.other;
}

function getSourceIcon(sourceName: string) {
  const lower = sourceName.toLowerCase();
  if (lower.includes("explore"))
    return <Compass className="h-3.5 w-3.5 text-indigo-400 shrink-0" />;
  if (lower.includes("search")) return <Search className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  return <ExternalLink className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
}

export default function TrafficSourcesChart({ data }: TrafficSourcesChartProps) {
  const theme = useChartTheme();
  const [metric, setMetric] = useState<"acquisitions" | "share">("acquisitions");

  const { breakdown, timeline, totalAcquisitions } = data;

  // Donut chart option
  const donutOption = useMemo<ChartOption>(() => {
    const pieData = breakdown.map((item) => ({
      name: item.displayName,
      value: item.acquisitions,
      itemStyle: { color: getSourceColor(item.source) },
      source: item,
    }));

    return {
      tooltip: {
        ...shellTooltip(theme),
        trigger: "item",
        formatter: (params: TopLevelFormatterParams) => {
          const p = Array.isArray(params) ? params[0] : params;
          const item = (p.data as { source?: (typeof breakdown)[number] })?.source;
          if (!item) return "";

          const shareStr = `${item.share.toFixed(1)}%`;
          const cvrStr = `${(item.conversionRate * 100).toFixed(1)}%`;
          const rows =
            tooltipRow(
              "Acquisitions",
              item.acquisitions.toLocaleString(),
              theme,
              getSourceColor(item.source),
            ) +
            tooltipRow("Share of Total", shareStr, theme) +
            tooltipRow("Conversion Rate (CVR)", cvrStr, theme) +
            tooltipRow("Listing Visitors", item.visitors.toLocaleString(), theme);

          return tooltipTitle(item.displayName, theme) + rows;
        },
      },
      series: [
        {
          name: "Acquisitions by Source",
          type: "pie",
          radius: ["55%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: theme.background,
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: false,
            },
            scale: true,
            scaleSize: 6,
          },
          data: pieData,
        },
      ],
    };
  }, [breakdown, theme]);

  // Timeline dynamics chart option
  const timelineOption = useMemo<ChartOption>(() => {
    if (!timeline || timeline.length === 0) {
      return {};
    }

    const dates = timeline.map((pt) => {
      // Format YYYY-MM-DD to "MMM d"
      const parts = pt.date.split("-");
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10) - 1;
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return `${monthNames[monthNum] || parts[1]} ${parseInt(parts[2], 10)}`;
      }
      return pt.date;
    });

    const searchSeries = timeline.map((pt) =>
      metric === "acquisitions" ? pt.search : pt.total > 0 ? (pt.search / pt.total) * 100 : 0,
    );
    const exploreSeries = timeline.map((pt) =>
      metric === "acquisitions" ? pt.explore : pt.total > 0 ? (pt.explore / pt.total) * 100 : 0,
    );
    const otherSeries = timeline.map((pt) =>
      metric === "acquisitions" ? pt.other : pt.total > 0 ? (pt.other / pt.total) * 100 : 0,
    );

    return {
      grid: {
        top: 24,
        right: 16,
        bottom: 32,
        left: 48,
        containLabel: false,
      },
      tooltip: {
        ...shellTooltip(theme),
        trigger: "axis",
        axisPointer: {
          type: "cross",
          lineStyle: {
            color: theme.border,
            type: "dashed",
          },
        },
        formatter: (params: TopLevelFormatterParams) => {
          const list = Array.isArray(params) ? params : [params];
          if (list.length === 0) return "";
          const first = list[0];
          const rawDate = timeline[first.dataIndex]?.date ?? first.name;

          let rows = "";
          let sumDay = 0;
          for (const item of list) {
            const val = typeof item.value === "number" ? item.value : 0;
            const valStr = metric === "acquisitions" ? val.toLocaleString() : `${val.toFixed(1)}%`;
            rows += tooltipRow(item.seriesName ?? "", valStr, theme, item.color as string);
            sumDay += val;
          }

          if (metric === "acquisitions") {
            rows += tooltipRow(
              "Total Day Installs",
              sumDay.toLocaleString(),
              theme,
              theme.foreground,
            );
          }

          return tooltipTitle(rawDate, theme) + rows;
        },
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.muted, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.muted,
          fontSize: 11,
          formatter: (v: number) =>
            metric === "acquisitions"
              ? v >= 1000
                ? `${(v / 1000).toFixed(1)}k`
                : `${v}`
              : `${v}%`,
        },
        splitLine: {
          lineStyle: { color: theme.border, type: "dashed", opacity: 0.6 },
        },
      },
      series: [
        {
          name: "Explore",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          data: exploreSeries,
          lineStyle: { color: SOURCE_COLORS.explore, width: 2.5 },
          itemStyle: { color: SOURCE_COLORS.explore },
          areaStyle: {
            color: SOURCE_COLORS.explore,
            opacity: 0.12,
          },
        },
        {
          name: "Search",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          data: searchSeries,
          lineStyle: { color: SOURCE_COLORS.search, width: 2.5 },
          itemStyle: { color: SOURCE_COLORS.search },
          areaStyle: {
            color: SOURCE_COLORS.search,
            opacity: 0.12,
          },
        },
        {
          name: "Other / External",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          data: otherSeries,
          lineStyle: { color: SOURCE_COLORS.other, width: 2.5 },
          itemStyle: { color: SOURCE_COLORS.other },
          areaStyle: {
            color: SOURCE_COLORS.other,
            opacity: 0.12,
          },
        },
      ],
    };
  }, [timeline, metric, theme]);

  if (!breakdown || breakdown.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Acquisition Traffic Sources</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              Play Console Breakdown
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Distribution of organic search, explore recommendations, and external channels
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMetric("acquisitions")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              metric === "acquisitions"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            Acquisitions
          </button>
          <button
            type="button"
            onClick={() => setMetric("share")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
              metric === "share"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            Share (%)
          </button>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
        {/* Left: Donut Chart & Breakdown Cards */}
        <div className="xl:col-span-5 flex flex-col sm:flex-row xl:flex-col items-center gap-4">
          {/* Donut Chart with centered summary */}
          <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
            <EChart
              option={donutOption}
              height={192}
              className="w-full h-full"
              ariaLabel="Traffic sources donut chart"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-lg font-bold font-mono text-foreground leading-tight">
                {totalAcquisitions.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">
                Total Installs
              </span>
            </div>
          </div>

          {/* Breakdown cards list */}
          <div className="flex-1 w-full space-y-2">
            {breakdown.map((item) => {
              const color = getSourceColor(item.source);
              return (
                <div
                  key={item.source}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 p-2.5 transition-colors hover:border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getSourceIcon(item.source)}
                    <div className="truncate">
                      <div className="text-xs font-medium text-foreground truncate">
                        {item.displayName}
                      </div>
                      <div className="text-[10px] text-muted">
                        {item.visitors.toLocaleString()} views •{" "}
                        {(item.conversionRate * 100).toFixed(1)}% CVR
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold font-mono text-foreground">
                      {item.acquisitions.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-medium font-mono" style={{ color }}>
                      {item.share.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Timeline Dynamics */}
        <div className="xl:col-span-7 flex flex-col justify-center min-h-[220px]">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-semibold text-foreground">
              Timeline Dynamics ({metric === "acquisitions" ? "Daily Installs" : "Daily Share"})
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-400" /> Explore
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Search
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Other
              </span>
            </div>
          </div>

          {timeline.length > 0 ? (
            <EChart
              option={timelineOption}
              height={220}
              className="w-full"
              ariaLabel="Traffic sources daily timeline chart"
            />
          ) : (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 text-muted text-xs">
              <Info className="h-5 w-5 mb-1 text-muted/60" />
              <span>No timeline data for the selected range</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
