# Plan — Agendas: real cron-backed reminders

Base: [`spec.md`](./spec.md). New service, scaffolded like
`services/knowledge-store` was in `001-vectorization` §5.3 (same layering
shape: `api/` → `services/` → `infrastructure/`).

## 1. Folder structure

```
services/scheduler/
├── src/
│   ├── index.ts                    # composition root: PrismaClient, pg-boss instance, TelegramBotClient
│   ├── core/server.ts               # createApp(deps)
│   ├── api/
│   │   └── remindersController.ts
│   ├── services/
│   │   └── reminderService.ts       # create/list/delete + pg-boss job registration
│   └── infrastructure/
│       ├── prismaClient.ts
│       └── telegramBotClient.ts     # thin HTTP client → services/telegram-bot's /push
├── prisma/schema.prisma
├── .env.example
├── package.json
└── tsconfig.json
```

`.env`: `PORT=30026`, `DATABASE_URL` (own database/schema), `TELEGRAM_BOT_URL=http://localhost:30023`.

## 2. `ReminderService`

```typescript
export interface CreateReminderInput {
  actionDescription: string;
  schedule: { type: 'ONCE'; at: string } | { type: 'RECURRING'; cron: string };
}

export class ReminderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pgBoss: PgBoss,
    private readonly telegramBotClient: TelegramBotClient,
  ) {}

  create(input: CreateReminderInput): Promise<Reminder>;   // AC1 — registers the pg-boss job, persists the row
  list(): Promise<Reminder[]>;                              // AC2
  delete(id: string): Promise<void>;                        // AC3 — pgBoss.unschedule / cancel + row delete

  // pg-boss worker handler, registered once in index.ts, not called directly by the controller:
  private async handleFire(reminderId: string): Promise<void>; // AC4/AC5
}
```

`create`: `ONCE` → `pgBoss.send(jobName, { reminderId }, { startAfter: input.schedule.at })`.
`RECURRING` → `pgBoss.schedule(jobName, input.schedule.cron, { reminderId })`.
Both register `jobName` as `reminder:<id>` so `delete` can
`pgBoss.unschedule(jobName)` unambiguously.

`handleFire`: loads the `Reminder`, calls
`telegramBotClient.push(reminder.actionDescription)`, sets
`lastFiredAt`/`lastDeliveryStatus` from the result. `pg-boss`'s own retry
policy (configured on the queue, a few attempts with backoff) wraps this
handler — a thrown error here triggers `pg-boss`'s retry, not a custom one.

## 3. `mcp-server` — new tools

`scheduleReminderTool.ts`, `listRemindersTool.ts`, `cancelReminderTool.ts`
(AC6/AC7) — same thin shape as `createKnowledgeEntryTool.ts`, each calling
a new `SchedulerClient` (`src/infraestructure/http/schedulerClient.ts`)
against `SCHEDULER_URL` (new env var, `services/mcp-server/.env`).

```typescript
export class SchedulerClient {
  constructor(private readonly baseUrl: string) {}
  createReminder(input: CreateReminderInput): Promise<Reminder>;
  listReminders(): Promise<Reminder[]>;
  deleteReminder(id: string): Promise<void>;
}
```

These are **regular, LLM-visible MCP tools** — unlike `searchKnowledgeEntries`,
there's no reason to hide them: the user explicitly asks for a reminder in
chat, so the LLM choosing to call `scheduleReminder` in response is exactly
the visible, expected behavior (contrast with retrieval, which runs
automatically and silently every turn regardless of what's asked).

## 4. Design patterns applied

- **Service Layer**: `ReminderService` owns all `pg-boss` interaction —
  controller never touches `pg-boss` directly.
- **Dependency Injection**: `PrismaClient`, `PgBoss` instance,
  `TelegramBotClient` all constructed once in `index.ts`, injected into
  `ReminderService`.
- No Strategy/Factory needed — one delivery channel (Telegram) this round;
  add one only when a second channel (WhatsApp) is real, not speculatively.

## 5. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `ReminderService` (mocked `PrismaClient`, `PgBoss`, `TelegramBotClient`) | AC1 (both schedule types register the right `pg-boss` call), AC3 (unschedule + delete), `handleFire` (AC4/AC5 — success and failure paths, status recorded) |
| `remindersController` (supertest) | one test per endpoint |
| `mcp-server`'s three new tools + `SchedulerClient` | mirrors `createKnowledgeEntryTool`'s existing test pattern |

## 6. Build order (→ `tasks.md`)

1. `services/scheduler` scaffold (`package.json`, `tsconfig.json`,
   `vitest.config.ts`, Prisma schema, `pg-boss` dependency).
2. `ReminderService` (create/list/delete) + tests.
3. `handleFire` + `TelegramBotClient` + tests.
4. Controller + routes + composition root.
5. `mcp-server`: `SchedulerClient` + 3 tools, registered.
6. Root `docker-compose.yml`/`package.json`: `dev:scheduler`,
   `build:scheduler`, `start:scheduler` scripts (mirrors
   `knowledge-store`'s existing entries).
7. Manual end-to-end: create a 1-minute-out one-off reminder via chat,
   confirm it fires and (once `telegram-bot` exists) actually arrives.
