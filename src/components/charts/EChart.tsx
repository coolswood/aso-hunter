import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { echarts } from "./setup";
import type { ChartOption } from "./setup";

interface EChartProps {
  option: ChartOption;
  /** Pixel height for fixed-height charts; omit when `style` sizes the box
   * (e.g. the world map uses an aspect ratio). */
  height?: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

/** Thin React wrapper around a modular echarts instance: creates the chart
 * once, keeps it resized to its container, applies options immutably
 * (notMerge - callers rebuild the whole option per change, e.g. on theme flip
 * or keyword-visibility toggle, and stale series must not survive) and
 * disposes on unmount.
 *
 * AppTabs mounts every tab's content up front and hides inactive ones with
 * CSS, so the container can be 0x0 here. Grid charts tolerate a zero-size
 * init, but the map series' geo fit crashes on it - so options are applied
 * only once the container has a size, and the ResizeObserver re-applies the
 * pending option the moment a hidden tab becomes visible. */
export default function EChart({ option, height, className, style, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const optionRef = useRef(option);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = echarts.init(container);
    chartRef.current = chart;

    function apply() {
      const el = containerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
      chart.resize();
      chart.setOption(optionRef.current, { notMerge: true });
    }

    const observer = new ResizeObserver(apply);
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart || container.clientWidth === 0 || container.clientHeight === 0) return;
    chart.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ ...(height != null ? { height } : null), ...style }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    />
  );
}
