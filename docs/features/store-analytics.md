# Аналитика эффективности Google Play (Store Analytics)

> **Одна строка:** Аналитика органического трафика из Google Play Console: источники установки (Explore vs Search vs Other) с Donut-диаграммой и динамикой во времени, реальные поисковые запросы, инсталлы, конверсия и фильтрация по интервалам через календарь.

## Входные точки

- Вкладка: `StoreAnalyticsSection.tsx` в `src/pages/AppDetailPage.tsx`
- Диаграммы источников: `src/components/store-analytics/TrafficSourcesChart.tsx` (ECharts)
- Выбор дат: `src/components/ui/DateRangePicker.tsx` (обёртка над `react-day-picker` v10)
- REST: `server/routes/apps.google-play.ts` (`/api/apps/:id/google-play/terms`, `/candidates`, `/summary`, `/sync`)
- Логика отчетов: `src/lib/googlePlayReports/` (OAuth-токен, чтение GCS, парсинг CSV `store_performance_traffic_source.csv`)

## Поток данных

```
UI (StoreAnalyticsSection) ─► DateRangePicker (выбор диапазона дат)
           │
           ├─► REST /api/apps/:id/google-play/terms?startDate=...&endDate=...
           │         │
           │         ├─► Drizzle (googlePlayTrafficSources) ─► TrafficSourcesChart (Donut + Timeline)
           │         │
           │         └─► Drizzle (googlePlaySearchTerms) ─► Таблица поисковых фраз
           │
           └─► Кнопка "Track (+)" ─► POST /api/apps/:id/keywords ─► keywords
```

## Карта файлов

| Файл                                                       | Роль                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/components/store-analytics/StoreAnalyticsSection.tsx` | UI вкладки «Store Analytics»: KPI карточки, блок диаграмм, таблица запросов, фильтры              |
| `src/components/store-analytics/TrafficSourcesChart.tsx`   | Визуализация источников трафика: Donut-диаграмма распределения долей и график динамики во времени |
| `src/components/ui/DateRangePicker.tsx`                    | Интерактивный выпадающий календарь диапазона дат на `react-day-picker` с быстрыми пресетами       |
| `server/routes/apps.google-play.ts`                        | REST-роуты получения сводки, источников трафика и поисковых терминов                              |
| `src/lib/googlePlayReports/sync.ts`                        | Синхронизация и агрегация отчётов Play Console из GCS (источники и поисковые термины)             |
| `src/db/schema.ts`                                         | Таблицы `googlePlaySearchTerms` и `googlePlayTrafficSources`                                      |

## API

- `GET /api/apps/:id/google-play/terms?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — агрегация источников трафика (`sources.breakdown`, `sources.timeline`), поисковых терминов и сводных показателей.
- `GET /api/apps/:id/google-play/summary` — общая сводка и диапазон дат (minDate, maxDate).
- `GET /api/apps/:id/google-play/candidates` — топ терминов без отслеживания для рекомендательного баннера.
- `POST /api/apps/:id/google-play/sync` — запуск синхронизации из GCS бакета Google Play Console.

## Хранение

- `googlePlaySearchTerms`: поисковые фразы, инсталлы, визиты, CVR.
- `googlePlayTrafficSources`: ежедневные показатели по источникам (`Google Play search`, `Google Play explore`, `Other`).

## Инварианты и подводные камни

- Google Play Console разделяет трафик страницы на 3 фундаментальных источника: **Google Play explore** (рекомендации, похожие приложения, главная витрина), **Google Play search** (поисковая строка) и **Other** (внешние переходы, UTM, диплинки).
- Поисковые фразы в Google Play отдаются глобально без разбивки по странам (ограничения конфиденциальности Google), поэтому детальная аналитика Play Console вынесена во вкладку Store Analytics.
- При выборе диапазона дат в календаре мгновенно пересчитываются и Donut-диаграмма, и график динамики, и таблица фраз.

## Связи

- Ключевые слова: [keywords.md](./keywords.md)
- Модуль графиков: [charts.md](./charts.md)
- Модуль отчётов: [googlePlayReports README](../../src/lib/googlePlayReports/README.md)
- Общая архитектура: [../ARCHITECTURE.md](../ARCHITECTURE.md)
