# Графики и карта (ECharts)

> **Одна строка:** вся визуализация (3 линейных графика + карта мира) на единой библиотеке echarts через модуль `src/components/charts/`.

## Входные точки

- Модуль визуализации: `src/components/charts/` (см. его [README](../../src/components/charts/README.md))
- Компоненты: `src/components/ProductHealthChart.tsx`, `src/components/RankHistoryChart.tsx`, `src/components/KeywordsOverviewChart.tsx`, `src/components/WorldMap.tsx`
- Палитра и темы: `src/globals.css` (`--accent`, `--success/warning/danger`, `--series-1..8`)

## Поток данных

```
Компонент графика ─► useChartTheme() (цвета из CSS-переменных)
                  └► useMemo(option) ─► EChart (setOption, notMerge)
WorldMap          ─► world-atlas (TopoJSON) ─► topojson-client ─► registerMap("world") ─► series type:"map"
```

Данные приходят пропсами (`ranks`, `keywords`, `results`) или fetch'ем внутри компонента (`ProductHealthChart` → `/api/apps/:id/product-health`).

## Карта файлов

| Файл                               | Роль                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| `src/components/charts/EChart.tsx` | React-обёртка над echarts-инстансом (init/resize/dispose) |
| `src/components/charts/setup.ts`   | модульная регистрация echarts + тип `ChartOption`         |
| `src/components/charts/theme.ts`   | резолв CSS-переменных в конкретные цвета для canvas       |
| `src/components/charts/tooltip.ts` | общий стиль HTML-тултипов                                 |
| `src/components/WorldMap.tsx`      | гео-карта: ранги по странам, пороговые цвета              |

## Инварианты и подводные камни

- Цвета серий — фиксированные слоты `--series-1..8` (CVD-safe порядок), не переназначаются; максимум 8 серий (`MAX_SERIES`).
- Ось рангов инвертирована (`inverse: true`), домен расширяется на ±1 от данных, минимум 1.
- Позиции `null` («не в топе») соединяются линией (`connectNulls`).

## Связи

- Трекинг ключевых слов: `src/components/KeywordsSection.tsx` (потребители графиков)
- Global Reach: `src/components/GlobalReachSection.tsx` → `WorldMap`
- Product health: [../ARCHITECTURE.md](../ARCHITECTURE.md), `src/components/ProductHealthChart.tsx`

---

_Обновляй этот файл при любой правке фичи (правило AGENTS.md №8). Держи тощим: ссылайся на код, не дублируй его._
