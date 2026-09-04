# Трекинг ключевых слов

> **Одна строка:** Мониторинг позиций приложения по поисковым запросам в выбранном сторфронте, оценка динамики (Change, Best Rank) и метрик поискового спроса (Popularity, Difficulty, Effectiveness, Apps).

## Входные точки

- Страница: `src/pages/AppDetailPage.tsx` (вкладка «Keywords»)
- Компоненты: `src/components/KeywordsSection.tsx`, `src/components/keywords/KeywordTable.tsx`, `src/components/keywords/KeywordMetricBadges.tsx`, `src/components/keywords/GooglePlayCandidates.tsx`
- REST: `server/routes/apps.keywords.ts` (`/api/apps/:id/keywords`), `server/routes/apps.google-play.ts` (`/api/apps/:id/google-play/*`), `server/routes/track.ts` (`/api/track`)
- MCP: `server/mcp.ts` (инструменты `add_keyword`, `auto_detect_keywords`)
- Логика: `src/lib/keywordMetrics.ts` (чистые клиентские расчеты), `src/lib/appService.ts` (`trackKeyword`, `autoDetectKeywords`), `src/lib/research.ts` (`volumeAndDifficulty`), `src/lib/googleDemand.ts` (Google Web Suggest & Trends), `src/lib/googlePlayReports` (интеграция с отчетами GCS и реальные инсталлы)

## Поток данных

```
UI (KeywordTable, GooglePlayCandidates) ─► REST /api/apps/:id/keywords, /api/apps/:id/google-play
                                            ├─► googlePlayReports.syncGooglePlaySearchTerms ─► GCS bucket (store_performance)
                                            ├─► stores.findRank / analyzeTerm ─► App Store / Google Play
                                            ├─► googleDemand.getGoogleDemandSignal ─► Google Web & Trends
                                            └─► Drizzle (@/db) ─► keywords, keywordRanks, googlePlaySearchTerms
```

## Карта файлов

| Файл                                               | Роль                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/keywordMetrics.ts`                        | Чистые функции расчета Best Rank, Change Delta, Effectiveness Score           |
| `src/lib/googleDemand.ts`                          | Запросы к Google Web Suggest и Google Trends Topics с кэшированием            |
| `src/lib/bulkKeywords.ts`                          | Чистый парсер списка ключевых фраз (разделение по \n и запятым, дедупликация) |
| `src/lib/googlePlayReports/`                       | Модуль синхронизации отчетов Google Play Console: auth, storage, csv, sync    |
| `src/components/keywords/KeywordMetricBadges.tsx`  | Визуальные бейджи рангов, прогресс-бар популярности, индикаторы динамики      |
| `src/components/keywords/KeywordTable.tsx`         | Таблица ключевых слов с GP-установками/CVR, сортировкой и графиками           |
| `src/components/keywords/GooglePlayCandidates.tsx` | Блок обнаружения ключевых слов из Google Play Console с кнопками добавления   |
| `src/components/RankHistoryChart.tsx`              | Индивидуальный график истории позиций ключа (ECharts, диапазоны 7D/14D/30D)   |
| `src/components/keywords/KeywordSearchInput.tsx`   | Умный ввод с живыми подсказками стора, рангами приложения и метриками         |
| `src/components/keywords/BulkAddKeywordsModal.tsx` | Модальное окно для массовой вставки списка ключевых слов                      |
| `src/components/KeywordsSection.tsx`               | Контейнер со строкой поиска/добавления ключей, GP-кандидатами и таблицей      |
| `server/routes/apps.keywords.ts`                   | REST-маршруты CRUD, подсказок, обогащения метриками Google Play               |
| `server/routes/apps.google-play.ts`                | REST-маршруты синхронизации отчетов GCS, кандидатов и сводки Play Console     |

## API / MCP

- `GET /api/apps/:id/keywords?country=us` — список ключевых слов сторфронта с историей замеров (до 30 точек) и метриками `googlePlayStats`.
- `GET /api/apps/:id/keywords/suggestions?term=...&country=us` — живые подсказки стора с позициями и метриками.
- `GET /api/apps/:id/google-play/candidates` — список запросов из Play Console с инсталлами, которых еще нет в трекинге.
- `GET /api/apps/:id/google-play/summary` — агрегированная сводка установок и поисковых запросов Google Play.
- `POST /api/apps/:id/google-play/sync` — запуск синхронизации свежих отчетов из GCS бакета.
- `POST /api/apps/:id/keywords` — добавить ключевое слово (`{ term, country }`).
- `POST /api/apps/:id/keywords/bulk` — массовое добавление списка слов (`{ terms: string[], country }`), с пропуском дублей.
- `POST /api/apps/:id/keywords/auto-detect` — автодетект ключей из заголовка/подзаголовка.
- `DELETE /api/apps/:id/keywords/:keywordId` — удаление одного ключа.
- `DELETE /api/apps/:id/keywords/bulk` — массовое удаление ключей (`{ ids: string[] }`).
- `POST /api/apps/:id/keywords/refresh-metrics` — пересчет Popularity/Difficulty/Apps для существующих ключей.

## Хранение

- Таблица `Keyword` (`keywords` в `src/db/schema.ts`): `id`, `appId`, `term`, `country`, `volume`, `difficulty`, `appsCount`, `createdAt`. Уникальный индекс по `(appId, term, country)`.
- Таблица `KeywordRank` (`keywordRanks`): `id`, `keywordId`, `position`, `checkedAt`.
- Таблица `GooglePlaySearchTerm` (`googlePlaySearchTerms`): `id`, `appId`, `date`, `searchTerm`, `acquisitions`, `visitors`, `conversionRate`, `createdAt`. Уникальный индекс по `(appId, date, searchTerm)`.

## Инварианты и подводные камни

- **Сторфронт привязан к строке**: каждый ключ трекается в конкретной стране (`country`). Поиск и ранги проверяются строго в этом сторфронте.
- **История рангов**: массив `ranks` возвращается отсортированным по `checkedAt DESC` (нулевой элемент — самый свежий).
- **Разделение слоев**: `keywordMetrics.ts` — абсолютно чистый клиентский модуль без серверных импортов (cheerio, stores, drizzle).

## Связи

- Селектор стран: [country-selector.md](./country-selector.md)
- Графика и чарты: [charts.md](./charts.md)
- Общая карта: [../ARCHITECTURE.md](../ARCHITECTURE.md)

## Google Ads API (Keyword Planner) — статус интеграции

- **Текущее состояние**: все 5 параметров авторизации (`CUSTOMER_ID`, `DEVELOPER_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`) получены и сохранены в `.env`. Подключение к OAuth2 и эндпоинтам проверено через `scripts/test-google-ads.ts`.
- **Ожидание**: отправлена заявка на **Basic Access** в Центре API Google Ads (приложена официальная документация `docs/ASO-Hunter-Tool-Documentation.pdf`).
- **План действий после одобрения заявки**:
  1. Запустить `bun scripts/test-google-ads.ts` для подтверждения боевого ответа.
  2. Реализовать сервис `src/lib/googleAdsVolume.ts` для получения точных месячных объемов поиска (`avgMonthlySearches`).
  3. Интегрировать объемы в расчет Popularity и отображение в таблице ключевых слов.
