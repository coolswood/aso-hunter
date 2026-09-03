import type { ChartTheme } from "./theme";

/** Base ECharts tooltip config replicating the shared tooltip shell the
 * recharts charts used (rounded card, 1px border, xs text, soft shadow) with
 * resolved theme colors. `extraCss` appends per-chart rules (e.g. the
 * keywords tooltip's max-width). */
export function shellTooltip(theme: ChartTheme, extraCss = "") {
  return {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: theme.muted, fontSize: 12, fontFamily: "inherit" },
    extraCssText:
      "border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); line-height: 1.5;" +
      extraCss,
  };
}

/** Tooltip title line (usually the date), styled like the old font-medium row. */
export function tooltipTitle(text: string, theme: ChartTheme): string {
  return `<div style="font-weight: 500; color: ${theme.foreground}">${text}</div>`;
}

/** "label .... value" row: muted label on the left, bold tabular value on the
 * right, optionally colored (series color, success/danger for deltas). */
export function tooltipRow(
  label: string,
  value: string,
  theme: ChartTheme,
  valueColor?: string,
): string {
  const color = valueColor ?? theme.foreground;
  return (
    `<div style="display: flex; align-items: center; justify-content: space-between; gap: 24px">` +
    `<span>${label}</span>` +
    `<span style="color: ${color}; font-weight: 600; font-variant-numeric: tabular-nums">${value}</span>` +
    `</div>`
  );
}
