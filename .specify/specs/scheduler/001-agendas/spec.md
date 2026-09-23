# Spec — Agendas: real cron-backed reminders

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (new `services/scheduler`) |
| **Depends on** | none new (parallel to the other specs in this round) |
| **Depended on by** | [`telegram-bot/001-channel`](../../telegram-bot/001-channel/spec.md) (delivery), [`frontend/004-chat-shell`](../../frontend/004-chat-shell/spec.md) AC8 (Agendas tab) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

"Todos los días a las 15:30, hacéme acordar tal cosa" has to actually fire
— not just be acknowledged and forgotten. A new service,
`services/scheduler`, owns a real job queue (`pg-boss`) for one-off and
recurring reminders, created via a new MCP tool from chat, listed in the
**Agendas** tab, and delivered for real over Telegram
(`telegram-bot/001-channel`) when they're due.

## 2. Why a new service, not folded into `knowledge-store`

Confirmed 2026-09-17: a `pg-boss` worker is a background process with its
own failure modes (a stuck/crashing worker) — isolating it in its own
service means it can't take `knowledge-store`'s request-serving path down
with it. Matches `CLAUDE.md`'s own roadmap language ("something like
scheduler/task-queue"). Port **30026** (`docs/ports.md`).

## 3. User Story & Acceptance Criteria

**As the user**, I tell ALMA to remind me of something, once or on a
recurring schedule, and it actually happens — delivered to me, not just
logged somewhere I have to go check.

- **AC1**: `POST /reminders` creates a reminder: `{ actionDescription:
  string, schedule: { type: 'once', at: ISO8601 } | { type: 'recurring',
  cron: string } }`. **Both one-off and recurring are supported** — the
  example Felix gave ("todos los días a las 15:30") is explicitly recurring,
  confirmed this needs real cron support, not just "remind me once."
- **AC2**: `GET /reminders` lists all reminders for the current user —
  `{ id, actionDescription, schedule, active, lastFiredAt, lastDeliveryStatus
  }[]` — consumed read-only by `frontend/004-chat-shell` AC8's Agendas tab.
- **AC3**: `DELETE /reminders/:id` cancels the underlying `pg-boss` job and
  removes the reminder.
- **AC4**: When a reminder fires, `scheduler` calls
  `telegram-bot/001-channel`'s push endpoint with `actionDescription` as
  the literal message text — **no LLM call at fire time** (§7.1). Delivery
  success/failure is recorded on the reminder row (`lastDeliveryStatus`),
  visible in the Agendas tab — a failed delivery is never silent.
- **AC5**: A delivery failure (e.g. `telegram-bot` unreachable) does **not**
  crash the scheduler process or lose the reminder — `pg-boss`'s built-in
  retry (a few attempts with backoff) applies before the row is marked
  failed.
- **AC6**: **MCP tool** `scheduleReminder` (`mcp-server`, new) lets the LLM
  create a reminder from natural chat ("recordame mañana a las 9", "todos
  los días a las 15:30...") — the LLM is responsible for translating the
  user's phrasing into `{ actionDescription, schedule }`; `scheduler` itself
  does no natural-language parsing.
- **AC7**: A companion `cancelReminder`/`listReminders` pair of MCP tools
  lets chat cancel/list reminders too, not just create them.

## 4. Data model

```prisma
model Reminder {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id])
  actionDescription  String
  scheduleType       ReminderScheduleType
  scheduledAt        DateTime?   // for ONCE
  cronExpression     String?     // for RECURRING
  pgBossJobName      String      // the pg-boss job/queue name this reminder maps to
  active             Boolean     @default(true)
  lastFiredAt        DateTime?
  lastDeliveryStatus ReminderDeliveryStatus?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
}
enum ReminderScheduleType { ONCE RECURRING }
enum ReminderDeliveryStatus { DELIVERED FAILED }
```

Owned by `services/scheduler`'s **own** Postgres connection — a separate
Prisma schema/service from `knowledge-store`, per §2's isolation reasoning
(same physical Postgres container in dev is fine; `pg-boss` also creates
its own internal schema in the same database automatically).

## 5. Defaults & Assumptions (mark any correction inline)

1. **No LLM call at fire time (AC4)** — the reminder's text is delivered
   literally, as the user/LLM phrased it when creating it. Not directly
   confirmed in the interview; flagged since a "smarter" contextual
   rephrasing at fire time is plausible future work, just not this round's
   default.
2. **`scheduler` has its own Postgres connection**, not `knowledge-store`'s
   — consistent with §2's service-isolation reasoning; the two databases
   can live in the same dev Postgres container (different logical
   databases or schemas), not necessarily separate infrastructure.
3. **No auth this iteration** — same trust model as `knowledge-store`
   (`docs/context.md`'s "single local user, no authentication" decision),
   localhost-only, single user.

## 6. Out of Scope — Future Work

- Editing an existing reminder (delete + recreate this round).
- Snoozing / rescheduling from a delivered reminder.
- Any delivery channel besides Telegram (WhatsApp stays future work).
- A contextual/LLM-phrased delivery message (§5.1).

## 7. Open Questions — resolved 2026-09-17

- **OQ1 — Recurrence needed?** → **Yes**, confirmed by Felix's own example
  being daily-recurring, not one-off.
- **OQ2 — Service placement** → **New `services/scheduler`**, confirmed
  (see §2).
- **OQ3 — Real delivery this round, or defer?** → **Real delivery via
  Telegram**, confirmed — Felix explicitly asked for this over the
  originally-recommended "log and show on next open" fallback.
