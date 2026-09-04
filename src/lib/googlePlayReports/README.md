# Модуль googlePlayReports

Модуль для чтения отчетов Google Play Console из персонального хранилища Google Cloud Storage (`pubsite_prod_*`), декодирования CSV и синхронизации поисковых запросов, установок и конверсий в базу данных PostgreSQL.

## Структура файлов

- `auth.ts` — OAuth2-авторизация и автоматическое обновление Bearer access-токена через `google-auth-library` по `refresh_token` из `config/google/google-oauth-token.json`.
- `storage.ts` — взаимодействие с Google Cloud Storage JSON API (`storage.googleapis.com`), скачивание списков файлов и отчетов.
- `csv.ts` — чистый парсер CSV и декодер кодировки UTF-16LE с сигнатурой BOM.
- `csv.test.ts` — тесты парсера и декодера.
- `sync.ts` — бизнес-логика синхронизации файлов `stats/store_performance/..._traffic_source.csv`, агрегации метрик по поисковым запросам и поиска кандидатов (запросов с инсталлами, которых еще нет в трекинге).
- `index.ts` — публичный barrel-файл.
