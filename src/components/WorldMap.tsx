"use client";

import { useMemo } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import * as isoCountries from "i18n-iso-countries";
import worldTopology from "world-atlas/countries-110m.json";
import { normalizeWorldFeatures } from "@/lib/worldMapData";
import { echarts, EChart, shellTooltip, useChartTheme } from "./charts";
import type { ChartOption, ChartTheme, TopLevelFormatterParams } from "./charts";

interface CountryResult {
  country: string;
  position: number | null;
}

const WORLD_MAP = "world";
/** Aspect ratio of the old hand-rolled SVG viewBox, kept so the card layout
 * doesn't change with the echarts port. */
const MAP_ASPECT_RATIO = "980 / 500";

const topology = worldTopology as unknown as Topology;
const rawFeatures = (
  feature(topology, topology.objects.countries as GeometryCollection) as unknown as {
    features: Feature<Geometry>[];
  }
).features;
// Cut antimeridian-crossing polygons (Russia, Fiji) and drop Antarctica so
// planar equirectangular projection renders without horizontal stripes.
const countryFeatures = normalizeWorldFeatures(rawFeatures);

// ECharts geo maps consume GeoJSON while world-atlas ships TopoJSON - expand
// once at module load and register globally. The cast bridges two structurally
// incompatible GeoJSON type hierarchies (geojson package vs echarts) over the
// same underlying format.
echarts.registerMap(WORLD_MAP, {
  type: "FeatureCollection",
  features: countryFeatures,
} as unknown as Parameters<typeof echarts.registerMap>[1]);

// world-atlas features carry ISO 3166-1 numeric ids in `geo.id`; results come
// as alpha-2. Names are taken from the same geometries echarts renders, so
// data names always match region names exactly.
const nameByNumeric = new Map<number, string>();
for (const geo of countryFeatures) {
  const name = (geo.properties as { name?: string } | null)?.name;
  if (name != null && geo.id != null) nameByNumeric.set(Number(geo.id), name);
}

function rankColor(position: number | null | undefined, theme: ChartTheme): string {
  if (position === undefined) return theme.border;
  if (position === null) return theme.danger;
  if (position <= 10) return theme.success;
  if (position <= 50) return theme.warning;
  return theme.danger;
}

export default function WorldMap({ results }: { results: CountryResult[] }) {
  const theme = useChartTheme();

  const option = useMemo<ChartOption>(() => {
    const data = results.flatMap((r) => {
      const numeric = isoCountries.alpha2ToNumeric(r.country.toUpperCase());
      const name = numeric ? nameByNumeric.get(Number(numeric)) : undefined;
      if (!name) return [];
      // Map series data values must be numeric - "scanned but not ranked"
      // items carry only the color, and the tooltip reads the value back.
      return [
        {
          name,
          ...(r.position !== null ? { value: r.position } : {}),
          itemStyle: { areaColor: rankColor(r.position, theme) },
        },
      ];
    });

    return {
      tooltip: {
        ...shellTooltip(theme),
        trigger: "item",
        confine: true,
        formatter: (params: TopLevelFormatterParams) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p) return "";
          // Regions without a scan still show "Not ranked", like the old SVG
          // map's hover card did.
          const entry = p.data as { value?: number | null } | undefined;
          const position = entry && entry.value != null ? entry.value : null;
          const valueHtml =
            position !== null
              ? `<span style="color: ${theme.foreground}">#${position}</span>`
              : `<span>Not ranked</span>`;
          return (
            `<div style="display: flex; align-items: center; gap: 8px">` +
            `<span style="width: 8px; height: 8px; border-radius: 9999px; flex-shrink: 0; background: ${rankColor(entry ? entry.value : undefined, theme)}"></span>` +
            `<div><div style="font-weight: 500; color: ${theme.foreground}">${p.name}</div><div>${valueHtml}</div></div>` +
            `</div>`
          );
        },
      },
      series: [
        {
          type: "map",
          map: WORLD_MAP,
          data,
          // Countries without a scan result keep the neutral border color.
          itemStyle: { areaColor: theme.border, borderColor: theme.background, borderWidth: 0.5 },
          emphasis: {
            label: { show: false },
            // Accent outline replaces the old hover:brightness-125 highlight.
            itemStyle: { borderColor: theme.accent, borderWidth: 1.2 },
          },
          select: { disabled: true },
          selectedMode: false,
        },
      ],
    };
  }, [results, theme]);

  return (
    <div className="relative">
      <EChart
        option={option}
        style={{ aspectRatio: MAP_ASPECT_RATIO }}
        ariaLabel="World map colored by the app's search rank per country for the selected keyword"
      />

      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--success)" }} />
          Top 10
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--warning)" }} />
          11-50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--danger)" }} />
          51+ / not found
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border border-border"
            style={{ background: "var(--border)" }}
          />
          Not scanned
        </span>
      </div>
    </div>
  );
}
