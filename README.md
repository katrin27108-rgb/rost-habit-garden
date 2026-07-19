# Рост — живой трекер привычек

«Рост» — устанавливаемое веб-приложение, в котором каждая привычка становится отдельным растением. Выполнения влияют на рост, состояние и внешний вид личного 3D-сада; данные работают локально и синхронизируются между устройствами после входа.

- Production: https://rost-habit-garden.katrin27108-rost.workers.dev
- Архитектура: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Быстрый онбординг: [docs/ONBOARDING.md](docs/ONBOARDING.md)
- Развёртывание: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Старая сборка GitHub Pages больше не является production-версией. Она сохраняется в ветке `archive/github-pages-2026-07-19` только как исторический снимок.

## Быстрый старт

Требования: Node.js 22.13 или новее и npm.

```bash
npm ci
npm run dev
```

Откройте адрес, напечатанный dev-сервером. Главная страница находится на `/`, полноэкранный интерактивный сад — на `/garden-prototype`.

## Проверки

```bash
npm run check
```

Команда последовательно запускает ESLint, доменные тесты, проверку документации и production build. Отдельные команды:

```bash
npm run lint
npm test
npm run docs:check
npm run build
```

## Карта проекта

| Область | Основное расположение |
| --- | --- |
| Главный трекер и dashboard | `app/page.tsx`, компоненты `app/*.tsx` |
| Правила привычек, серии и рост | `lib/domain.ts`, `lib/app-model.ts` |
| Локальные данные и очередь синхронизации | `lib/offline-store.ts` |
| Авторизация и синхронизация | `app/api/auth/`, `app/api/garden/`, `app/api/community/` |
| Активный интерактивный 3D-сад | `app/Garden3DPrototype.tsx`, `app/garden3d/` |
| Встроенный обзор сада | `app/LivingGarden.tsx` |
| D1 и схема данных | `db/`, `drizzle/` |
| Старый 2D-прототип | `app/GardenPrototype.tsx`, `app/garden/` |

Старый 2D-прототип не является активной игровой сценой. Не переносите в него новую функциональность без отдельного продуктового решения.

## Хранение и синхронизация

Без входа привычки сохраняются на устройстве. IndexedDB хранит очередь изменений для повторной отправки. После регистрации или входа API синхронизирует сад через Cloudflare D1. Таблицы описаны в `db/schema.ts`, а идемпотентная production-инициализация — в `drizzle/cloudflare-bootstrap.sql`.

## Работа с Git

- Ветки агента: `agent/<задача>`.
- Перед изменениями прочитайте [AGENTS.md](AGENTS.md) и [MEMORY.md](MEMORY.md).
- Изменения попадают в `main` через Pull Request и squash merge.
- `main` не переписывается принудительно.
- После успешных проверок push в `main` автоматически развёртывается в Cloudflare Workers.

Секреты никогда не коммитятся. Для локальных переменных скопируйте `.env.example` в `.env.local`; production-переменные хранятся в GitHub Secrets и Variables.
