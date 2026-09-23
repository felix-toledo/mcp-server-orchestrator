# Tasks — Agendas: real cron-backed reminders

Base: [`plan.md`](./plan.md) §6.

- [x] **T1 — Scaffold `services/scheduler`**: package/tsconfig/vitest
  config, Prisma schema (`Reminder` + enums), `pg-boss` dependency,
  `.env.example`. Root `package.json` gains
  `dev:scheduler`/`build:scheduler`/`start:scheduler`. `docs/ports.md` row
  flips `planned` → `active`.
  **Deviation from spec §4's literal Prisma snippet**: dropped the
  `user User @relation(...)` field — `services/scheduler` deliberately owns
  its own separate Postgres connection (spec §2's isolation reasoning), so
  there is no local `User` table a cross-database foreign key could point
  to (Postgres/Prisma can't express one anyway). `userId` itself was also
  dropped: with no local `User` row to resolve "the current user" against
  and this being single-user/no-auth (spec §5.3), an unfillable field would
  only be dead weight. Flagged here rather than silently diverging.
  **Real bug found live, not from a test**: the exact collision
  CLAUDE.md already documents for `mcp-server`'s removed `prisma/` —
  `scheduler` and `knowledge-store` both depend on `@prisma/client@6.16.2`
  from *different* schemas, and hashed to the same pnpm virtual store
  entry. Running `prisma generate` for `scheduler` first failed outright
  with `EPERM` (knowledge-store's dev server had the shared
  `query_engine-windows.dll.node` file open), and even once unblocked,
  whichever service generated last would have silently overwritten the
  other's generated client — a live corruption risk, not just a build
  nuisance. **Fixed** by giving `scheduler`'s schema its own custom
  generator `output` (`./generated/client`, gitignored) so it never touches
  knowledge-store's shared default location — a permanent fix, not a
  "don't run these two generates close together" workaround.
  **Follow-up found later in this round**: the *failed* `EPERM` attempt
  (before the `output` fix landed) had already partially overwritten the
  shared location before erroring out — `knowledge-store`'s `tsc` started
  failing with `Property 'chatSession'/'user'/'vaultFolder' does not exist
  on type 'PrismaClient'`, only noticed once later `telegram-bot` work
  triggered a `knowledge-store` typecheck again. Fixed by re-running
  `prisma generate` inside `knowledge-store` itself once more, now that
  scheduler's own generate no longer touches that shared path — a one-time
  cleanup of damage from before the real fix landed, not a recurring issue.
- [x] **T2 — `ReminderService`: create/list/delete`**: AC1–AC3.
  `randomUUID()`-generated id up front (not Prisma's own `@default(cuid())`)
  so `pgBossJobName` (`reminder:<id>`) can be set in the same `create` call
  instead of a create-then-update dance. Tests: 8 in
  `reminderService.test.ts`, covering both schedule types, delete
  (unschedule + deleteQueue + row delete), and `initialize`'s worker
  re-registration for already-active reminders.
- [x] **T3 — `ReminderService.handleFire` + `TelegramBotClient`**: AC4/AC5.
  `TelegramBotClient.push` is fail-open (`{ delivered: false }`, never
  throws) matching every other cross-service HTTP client in this codebase.
  `handleFire` records `lastFiredAt`/`lastDeliveryStatus` on **every**
  attempt (not only once pg-boss's retries are exhausted) — a later retry
  that succeeds overwrites `FAILED` with `DELIVERED`, so the row never sits
  stale; throwing on failure is what makes pg-boss's own retry/backoff
  apply, not a swallowed error. Not word-for-word confirmed in the spec
  interview, flagged as a reasonable implementation-time interpretation of
  AC4/AC5's wording. Tests: success, failure-records-and-throws, and
  "reminder deleted before it fired" (no-op, doesn't throw).
- [x] **T4 — Controller + routes + composition root**: full HTTP surface
  live (`POST/GET /reminders`, `DELETE /reminders/:id`), `pg-boss` worker
  registered via `ReminderService.initialize()` in `index.ts`. Same
  `asyncHandler` + final error middleware pattern as knowledge-store's own
  crash fix (`004-vault-folders-and-llm-summaries`'s tasks.md) — carried
  over proactively here since a crash would also kill pg-boss's in-process
  worker, not just the HTTP server. Tests: 8 in `server.test.ts`, including
  the same unhandled-rejection-returns-500 regression.
- [x] **T5 — `mcp-server`: `SchedulerClient` + 3 tools**: `scheduleReminder`,
  `listReminders`, `cancelReminder` (AC6/AC7), registered in
  `core/server.ts`, new `SCHEDULER_URL` env var. Tests mirror
  `createKnowledgeEntryTool`'s pattern (12 tests across the client + 3
  tools). HTTP contract note: spec AC1's `schedule.type` is lowercase
  (`'once'`/`'recurring'`) at the API boundary; the Prisma enum
  (`ReminderScheduleType`) is uppercase — `remindersController` is the one
  place that translates between the two, `ReminderService`'s own type
  matches the enum directly.
- [x] **T6 — Manual end-to-end**: real chat request ("Recordame en 2
  minutos que revise el horno") → `scheduleReminder` called → fired on
  time (~1.5s after the scheduled instant) → `lastDeliveryStatus: FAILED`
  correctly recorded (no `telegram-bot` running yet at that point). Also
  verified directly against the HTTP API: a 15-second one-off reminder
  fired within ~1s of its target time, and delete correctly unscheduled +
  removed it. **Real delivery confirmed later in the same round**, once
  `telegram-bot/001-channel` was up with a real bot token: a 5-second
  reminder fired and delivered for real over Telegram
  (`lastDeliveryStatus: DELIVERED`), and a fully natural chat request
  ("me harias acordar algo en 2 minutos? que me vaya con estela") worked
  unprompted end to end — see that spec's own T8 for the full writeup.
  **Real bug found live, not from a test**: the first live chat attempt
  ("en 2 minutos") computed `scheduledAt` almost 3 hours in the *past*
  relative to actual UTC — the LLM reasoned in local time ("now" + 2min)
  but wrote the result with a bare `Z` suffix without converting to UTC,
  so pg-boss treated it as already-due and fired it ~6 seconds after
  creation instead of after 2 real minutes. Root cause: `scheduleReminder`'s
  `at` field description only said "ISO 8601 timestamp," with nothing
  telling the LLM to establish the real current time/timezone first (a
  `get-current-time` MCP tool from the google-calendar server was already
  available in the tools list, just never called). **Fixed** by expanding
  the field's description to explicitly instruct calling `get-current-time`
  before computing a relative offset and converting the result to UTC, not
  local time with "Z" appended. Confirmed fixed: the next identical request
  computed a `scheduledAt` correctly ~2 minutes in the future.
