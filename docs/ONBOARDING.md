# Онбординг разработчика и агента

## Первые 15 минут

1. Прочитайте `AGENTS.md`, затем `MEMORY.md` и `docs/ARCHITECTURE.md`.
2. Проверьте `git status -sb` и создайте ветку `agent/<короткая-задача>`.
3. Установите Node.js 22.13+ и выполните `npm ci`.
4. Запустите `npm test`, затем `npm run dev`.
5. Проверьте `/` и `/garden-prototype`.

## Как выбрать место изменения

| Запрос | Начать здесь | Проверить рядом |
| --- | --- | --- |
| Карточки, мастер привычки, статистика | `app/page.tsx`, `app/HabitWizard.tsx`, `app/StatsPanel.tsx` | `lib/domain.ts`, `lib/messages.ts` |
| Расписание, серия, прогресс роста | `lib/domain.ts` | `tests/domain.test.ts` |
| Формат привычки и миграция | `lib/app-model.ts` | API сада, offline store |
| Сохранение без сети | `lib/offline-store.ts` | синхронизация в `app/page.tsx` |
| Вход и регистрация | `app/AuthModal.tsx`, `app/api/auth/` | `app/standalone-auth.ts`, D1 schema |
| Синхронизация и гости сада | `app/api/garden/`, `app/api/community/` | `db/schema.ts` |
| Управление, растения, погода 3D | `app/Garden3DPrototype.tsx`, `app/garden3d/` | `/garden-prototype` |
| Мини-превью на главной | `app/LivingGarden.tsx` | iframe полноэкранного сада |

Не начинайте новую 3D-функцию в `app/garden/`: это старый 2D-прототип.

## Минимальная проверка изменения

- Доменная логика: дополнить `tests/domain.test.ts`.
- API или база: проверить неавторизованный запрос, валидный запрос и некорректные данные.
- 3D-сад: проверить обычный и embedded-режим, клавиатуру и touch-управление.
- Документация или структура: выполнить `npm run docs:check`.
- Перед коммитом в `main`: выполнить `npm run check`.
