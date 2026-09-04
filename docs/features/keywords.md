# Трекинг ключевых слов

> **Одна строка:** Мониторинг позиций приложения по поисковым запросам в выбранном сторфронте, оценка динамики (Change, Best Rank) и метрик поискового спроса (Popularity, Difficulty, Effectiveness, Apps).

## Входные точки

- Страница: `src/pages/AppDetailPage.tsx` (вкладка «Keywords»)
- Компоненты: `src/components/KeywordsSection.tsx`, `src/components/keywords/KeywordTable.tsx`, `src/components/keywords/KeywordMetricBadges.tsx`
- REST: `server/routes/apps.keywords.ts` (`/api/apps/:id/keywords`), `server/routes/track.ts` (`/api/track`)
- MCP: `server/mcp.ts` (инструменты `add_keyword`, `auto_detect_keywords`)
- Логика: `src/lib/keywordMetrics.ts` (чистые клиентские расчеты), `src/lib/appService.ts` (`trackKeyword`, `autoDetectKeywords`), `src/lib/research.ts` (`volumeAndDifficulty`)

## Поток данных

```
UI (KeywordTable) ─► REST /api/apps/:id/keywords ─► appService.addKeyword / trackKeyword
                                                        ├─► stores.findRank / analyzeTerm ─► App Store / Google Play
                                                        └─► Drizzle (@/db) ─► keywords, keywordRanks
```

## Карта файлов

| Файл                                              | Роль                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/lib/keywordMetrics.ts`                       | Чистые функции расчета Best Rank, Change Delta, Effectiveness Score      |
| `src/components/keywords/KeywordMetricBadges.tsx` | Визуальные бейджи рангов, прогресс-бар популярности, индикаторы динамики |
| `src/components/keywords/KeywordTable.tsx`        | Таблица с сортировкой, чекбоксами и массовыми действиями                 |
| `src/components/keywords/KeywordSearchInput.tsx`  | Умный ввод с живыми подсказками стора, рангами приложения и метриками    |
| `src/components/KeywordsSection.tsx`              | Контейнер с формой добавления и автодетектом                             |
| `server/routes/apps.keywords.ts`                  | REST-маршруты CRUD, подсказок, массового удаления и обновления метрик    |

## API / MCP

- `GET /api/apps/:id/keywords?country=us` — список ключевых слов сторфронта с историей замеров (до 30 точек).
- `GET /api/apps/:id/keywords/suggestions?term=...&country=us` — живые подсказки стора с позициями и метриками.
- `POST /api/apps/:id/keywords` — добавить ключевое слово (`{ term, country }`).
- `POST /api/apps/:id/keywords/auto-detect` — автодетект ключей из заголовка/подзаголовка.
- `DELETE /api/apps/:id/keywords/:keywordId` — удаление одного ключа.
- `DELETE /api/apps/:id/keywords/bulk` — массовое удаление ключей (`{ ids: string[] }`).
- `POST /api/apps/:id/keywords/refresh-metrics` — пересчет Popularity/Difficulty/Apps для существующих ключей.

## Хранение

- Таблица `Keyword` (`keywords` в `src/db/schema.ts`): `id`, `appId`, `term`, `country`, `volume`, `difficulty`, `appsCount`, `createdAt`. Уникальный индекс по `(appId, term, country)`.
- Таблица `KeywordRank` (`keywordRanks`): `id`, `keywordId`, `position`, `checkedAt`.

## Инварианты и подводные камни

- **Сторфронт привязан к строке**: каждый ключ трекается в конкретной стране (`country`). Поиск и ранги проверяются строго в этом сторфронте.
- **История рангов**: массив `ranks` возвращается отсортированным по `checkedAt DESC` (нулевой элемент — самый свежий).
- **Разделение слоев**: `keywordMetrics.ts` — абсолютно чистый клиентский модуль без серверных импортов (cheerio, stores, drizzle).

## Связи

- Селектор стран: [country-selector.md](./country-selector.md)
- Графика и чарты: [charts.md](./charts.md)
- Общая карта: [../ARCHITECTURE.md](../ARCHITECTURE.md)
