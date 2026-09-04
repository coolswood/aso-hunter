# Аналитика поисковых запросов Google Play (Store Analytics)

> **Одна строка:** Аналитика органического трафика из Google Play Console: реальные поисковые запросы, инсталлы (acquisitions), конверсия и добавление эффективных фраз в отслеживание с фильтрацией по интервалам через календарь.

## Входные точки

- Вкладка: `StoreAnalyticsSection.tsx` в `src/pages/AppDetailPage.tsx`
- Выбор дат: `src/components/ui/DateRangePicker.tsx` (обёртка над `react-day-picker` v10)
- REST: `server/routes/apps.google-play.ts` (`/api/apps/:id/google-play/terms`, `/candidates`, `/summary`, `/sync`)
- Логика отчетов: `src/lib/googlePlayReports/` (OAuth-токен, чтение GCS, парсинг CSV `store_performance_traffic_source.csv`)

## Поток данных

```
UI (StoreAnalyticsSection) ─► DateRangePicker (выбор диапазона дат)
           │
           ├─► REST /api/apps/:id/google-play/terms?startDate=...&endDate=...
           │         │
           │         └─► Drizzle (googlePlaySearchTerms) ─► PostgreSQL
           │
           └─► Кнопка "Track (+)" ─► POST /api/apps/:id/keywords ─► keywords
```

## Карта файлов

| Файл                                                       | Роль                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/components/store-analytics/StoreAnalyticsSection.tsx` | UI вкладки «Store Analytics»: KPI карточки, таблица запросов, фильтры                       |
| `src/components/ui/DateRangePicker.tsx`                    | Интерактивный выпадающий календарь диапазона дат на `react-day-picker` с быстрыми пресетами |
| `server/routes/apps.google-play.ts`                        | REST-роуты получения сводки, агрегированных поисковых терминов и ручной синхронизации       |
| `src/lib/googlePlayReports/index.ts`                       | Сервис загрузки и обработки отчётов трафика Play Console из GCS                             |
| `src/db/schema.ts`                                         | Таблица `googlePlaySearchTerms`                                                             |

## API

- `GET /api/apps/:id/google-play/terms?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — агрегация уникальных терминов, инсталлов и визитов за период.
- `GET /api/apps/:id/google-play/summary` — общая сводка и диапазон дат (minDate, maxDate).
- `GET /api/apps/:id/google-play/candidates` — топ терминов без отслеживания для рекомендательного баннера.
- `POST /api/apps/:id/google-play/sync` — запуск синхронизации из GCS бакета Google Play Console.

## Хранение

- Таблица `googlePlaySearchTerms` (`src/db/schema.ts`): поля `appId`, `date`, `searchPhrase`, `storeListingVisitors`, `installers`, `dateFormatted`.

## Инварианты и подводные камни

- Google Play Console не отдаёт отчёты по поисковым фразам в разбивке по странам (только глобальные данные из-за ограничений конфиденциальности Google), поэтому аналитика вынесена в отдельную глобальную вкладку, а ключевые слова в `keywords` остаются привязаны к storefront/country.
- Календарь `DateRangePicker` работает с ISO датами `YYYY-MM-DD` и корректно форматирует отображение через `date-fns`.

## Связи

- Ключевые слова: [keywords.md](./keywords.md)
- Модуль отчётов: [googlePlayReports README](../../src/lib/googlePlayReports/README.md)
- Общая архитектура: [../ARCHITECTURE.md](../ARCHITECTURE.md)
