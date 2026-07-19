# Развёртывание

## Production

Каноническая среда — Cloudflare Workers + D1:

`https://rost-habit-garden.katrin27108-rost.workers.dev`

GitHub Pages не используется для актуального приложения. Старая статическая версия хранится в архивной ветке.

## GitHub Actions

Pull Request и push в `main` запускают CI. Deployment выполняется только для успешного push в `main` после lint, тестов, проверки документации и production build.

Настройки репозитория:

| Тип | Имя | Назначение |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | токен с D1 Edit и Workers Scripts Edit |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| Variable | `CLOUDFLARE_D1_DATABASE_ID` | ID production D1 |

Токену достаточно прав `D1:Edit`, `Workers Scripts:Edit` и `Account Settings:Read`. Не добавляйте значения в Git, workflow-логи или `MEMORY.md`.

## Последовательность deployment

1. Чистая установка зависимостей.
2. Production build в `dist/`.
3. `npm run deploy:prepare` подставляет D1 ID из GitHub Variable в сгенерированный `dist/server/wrangler.json`.
4. Идемпотентный `drizzle/cloudflare-bootstrap.sql` создаёт отсутствующие таблицы и индексы.
5. Wrangler развёртывает Worker и клиентские assets.

`dist/` не коммитится. Скрипт подготовки отказывается работать без валидного ID или без результата сборки.

## Откат

Откатывайте через Cloudflare Workers Versions либо повторно разворачивайте известный исправный коммит. Схему D1 нельзя откатывать удалением таблиц в автоматическом workflow; несовместимые миграции требуют отдельного плана и резервной копии.
