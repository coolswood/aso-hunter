# Модуль `charts` (ECharts)

> **Одна строка:** вся визуализация проекта (линейные графики + карта мира) на echarts, импортированном модульно через `echarts/core`.

## Публичный API (barrel `index.ts`)

| Экспорт                                      | Что даёт                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `EChart`                                     | React-обёртка: init/dispose, `ResizeObserver`, `setOption` с `notMerge: true`. |
| `useChartTheme` / `resolveChartTheme`        | Конкретные цвета из CSS-переменных `globals.css` (+ реакция на смену темы ОС). |
| `shellTooltip`, `tooltipTitle`, `tooltipRow` | Общий вид HTML-тултипов (аналог бывшего `ChartTooltipShell`).                  |
| `echarts`, типы `ChartOption` и др.          | Зарегистрированное ядро echarts для особых случаев (например, `registerMap`).  |

## Устройство

- `setup.ts` — модульная регистрация: `LineChart`, `MapChart`, `GridComponent`, `TooltipComponent`, `CanvasRenderer`. Тип опции `ChartOption = ComposeOption<...>` собран только из зарегистрированного — несуществующий компонент не скомпилируется.
- `theme.ts` — echarts рисует на canvas, где `var(--accent)` не резолвится, поэтому цвета читаются из `:root` через `getComputedStyle` и перечитываются при переключении `prefers-color-scheme`.
- `tooltip.ts` — тултипы echarts — HTML-строки из `formatter`; хелперы держат общий стиль (карточка, скругления, tabular-nums).
- `EChart.tsx` — тонкая обёртка вместо зависимости `echarts-for-react` (~50 строк, полный контроль типизации и lifecycle).

## Инварианты и подводные камни

- Опция всегда пересобирается целиком и применяется с `notMerge: true` — иначе при переключении видимости серий (тоггл ключевых слов) старые линии останутся на графике.
- `AppTabs` монтирует все табы сразу и прячет неактивные через CSS: контейнер может быть 0×0 в момент init. `ResizeObserver` дорисовывает при показе таба.
- Новый тип графика → добавить в `use()` в `setup.ts`, иначе `setOption` молча проигнорирует серию.

## Потребители

`ProductHealthChart`, `RankHistoryChart`, `KeywordsOverviewChart`, `WorldMap` (гео-карта, GeoJSON из `world-atlas` через `topojson-client`, `registerMap` на уровне модуля).
