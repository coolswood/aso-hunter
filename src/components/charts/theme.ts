import { useEffect, useState } from "react";

/** Concrete color values for ECharts: it renders to canvas, where CSS custom
 * properties (var(--accent), ...) cannot be resolved - those only work in
 * SVG/DOM. Values are read from :root at runtime so the light/dark palettes
 * in globals.css stay the single source of truth. */
export interface ChartTheme {
  background: string;
  foreground: string;
  card: string;
  border: string;
  muted: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  /** Fixed 8-slot categorical palette (globals.css --series-1..8). */
  series: string[];
}

const SERIES_VARS = [
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-4",
  "--series-5",
  "--series-6",
  "--series-7",
  "--series-8",
];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function resolveChartTheme(): ChartTheme {
  return {
    background: cssVar("--background"),
    foreground: cssVar("--foreground"),
    card: cssVar("--card"),
    border: cssVar("--border"),
    muted: cssVar("--muted"),
    accent: cssVar("--accent"),
    success: cssVar("--success"),
    warning: cssVar("--warning"),
    danger: cssVar("--danger"),
    series: SERIES_VARS.map(cssVar),
  };
}

/** Theme colors for canvas-rendered charts; re-resolves when the OS color
 * scheme flips (globals.css themes via prefers-color-scheme - there is no
 * in-app toggle), so dependent chart options rebuild with the new palette. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(resolveChartTheme);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(resolveChartTheme());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return theme;
}
