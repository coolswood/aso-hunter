import * as echarts from "echarts/core";
import { LineChart, MapChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type { LineSeriesOption, MapSeriesOption, PieSeriesOption } from "echarts/charts";
import type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from "echarts/components";

// Modular registration via echarts/core: only the chart types and components
// actually used end up in the client bundle - importing the full "echarts"
// package would pull in every chart and component it ships.
echarts.use([
  LineChart,
  MapChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { echarts };

export type { LineSeriesOption, MapSeriesOption, PieSeriesOption } from "echarts/charts";
export type {
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from "echarts/components";
export type { TopLevelFormatterParams } from "echarts/types/dist/shared";

/** Option type composed of exactly the charts/components registered above. */
export type ChartOption = ComposeOption<
  | LineSeriesOption
  | MapSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>;
