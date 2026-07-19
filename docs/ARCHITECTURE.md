# Архитектура «Рост»

## Контекст системы

```mermaid
flowchart LR
  User[Пользователь: телефон или компьютер] --> PWA[PWA / React UI]
  PWA --> Worker[vinext в Cloudflare Worker]
  Worker --> Auth[Auth API]
  Worker --> Garden[Garden и Community API]
  Auth --> D1[(Cloudflare D1)]
  Garden --> D1
  PWA --> Assets[Статические ресурсы и 3D-модели]
```

## Жизненный цикл привычки и растения

```mermaid
flowchart LR
  Wizard[Мастер привычки] --> Model[Модель v2: срок, расписание, растение]
  Model --> Local[Локальное сохранение]
  Local --> Complete[Отметка выполнения]
  Complete --> Domain[Расчёт серии, прогресса и здоровья]
  Domain --> View[Карточки и статистика]
  Domain --> Plant[Одно растение этой привычки]
  Plant --> Scene[Плавное отображение роста в 3D-саду]
```

## Offline-first синхронизация

```mermaid
sequenceDiagram
  participant UI as React UI
  participant LS as localStorage
  participant Q as IndexedDB queue
  participant API as /api/garden
  participant DB as D1
  UI->>LS: сохранить привычки немедленно
  UI->>Q: поставить изменение в очередь
  alt пользователь вошёл и сеть доступна
    Q->>API: отправить актуальное состояние
    API->>DB: upsert сада
    DB-->>API: publicId
    API-->>Q: подтверждение
    Q->>Q: удалить подтверждённую операцию
  else офлайн или без входа
    Q->>Q: сохранить до следующей попытки
  end
```

## Активный 3D-сад

```mermaid
flowchart TD
  Route[app/garden-prototype/page.tsx] --> Shell[Garden3DPrototype.tsx]
  Shell --> Game[game.ts: цикл и состояние]
  Game --> Scene[scene.ts: Babylon scene]
  Scene --> Camera[camera.ts: движение и обзор]
  Scene --> Environment[environment.ts: поле, небо, вода]
  Scene --> Plants[oak.ts и stylizedGame.ts: растения и декор]
  Scene --> Materials[materials.ts и shaders.ts]
  Game --> Weather[weather.ts: погода и время]
  Shell --> Placement[Выбор и размещение объекта]
  Domain[lib/domain.ts] --> Shell
```

`app/GardenPrototype.tsx` и `app/garden/` относятся к старому 2D/canvas-прототипу и не входят в активный граф.

## Маршрутизатор задач агента

```mermaid
flowchart TD
  Request[Новый запрос] --> Kind{Что меняется?}
  Kind -->|UI трекера| Dashboard[app/page.tsx и app/*.tsx]
  Kind -->|Правила привычки| Domain[lib/domain.ts и lib/app-model.ts]
  Kind -->|Offline и sync| Storage[lib/offline-store.ts и app/api/garden]
  Kind -->|Аккаунты и гости| API[app/api/auth и app/api/community]
  Kind -->|Интерактивный сад| Active3D[app/Garden3DPrototype.tsx и app/garden3d]
  Kind -->|Схема данных| Database[db и drizzle]
  Active3D -. не путать .-> Legacy[app/GardenPrototype.tsx и app/garden]
```

## Git и выпуск

```mermaid
flowchart LR
  Task[Задача] --> Main[Локальный main]
  Main --> Checks[npm run check]
  Checks --> Push[Обычный push в origin/main]
  Push --> CI[Повторная CI-проверка]
  CI --> Prepare[Подготовка D1-конфигурации]
  Prepare --> Deploy[Cloudflare Workers deploy]
  Deploy --> Prod[Production]
```

## Ключевые границы

- UI не вычисляет рост самостоятельно: он использует функции доменного слоя.
- 3D-сцена не владеет привычками и не является источником истины.
- API проверяет авторизацию и входные данные до обращения к D1.
- Локальная запись выполняется раньше сетевой синхронизации.
- Изменение сохранённой модели требует миграции старых локальных и серверных данных.
