# Модуль googlePlayReports

Модуль для чтения отчетов Google Play Console из персонального хранилища Google Cloud Storage (`pubsite_prod_*`), декодирования CSV и синхронизации поисковых запросов, установок и конверсий в базу данных PostgreSQL.

## Структура файлов

- `auth.ts` — OAuth2-авторизация и автоматическое обновление Bearer access-токена через `google-auth-library` по `refresh_token` из `config/google/google-oauth-token.json`.
- `storage.ts` — взаимодействие с Google Cloud Storage JSON API (`storage.googleapis.com`), скачивание списков файлов и отчетов.
- `csv.ts` — чистый парсер CSV и декодер кодировки UTF-16LE с сигнатурой BOM.
- `csv.test.ts` — тесты парсера и декодера.
- `dates.ts` — чистый хелпер `shiftIsoDate` для окон «последние N дней» поверх строковых дат отчетов (`YYYY-MM-DD`, UTC).
- `sync.ts` — бизнес-логика синхронизации файлов `stats/store_performance/..._traffic_source.csv`, агрегации метрик по поисковым запросам и поиска кандидатов (запросов с инсталлами, которых еще нет в трекинге; сортировка по установкам за последние 30 дней доступных данных, окно считается от `MAX(date)`).
- `index.ts` — публичный barrel-файл.

## Заметки по агрегатам

- `getGooglePlayStatsMap(appId, { windowDays })` — статистика по терминам; с `windowDays` берутся только последние N дней доступных данных (для калибровки volume «текущим» спросом).
- Данные Play Console — **мировые** (без разбивки по странам), это ограничение экспорта, а не выбор реализации.
