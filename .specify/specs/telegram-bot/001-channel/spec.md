# Spec — Telegram channel

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (new `services/telegram-bot`) |
| **Depends on** | [`knowledge-store/003-chat-sessions`](../../knowledge-store/003-chat-sessions/spec.md) (shared session memory) |
| **Depended on by** | [`scheduler/001-agendas`](../../scheduler/001-agendas/spec.md) AC4 (delivery), [`frontend/004-chat-shell`](../../frontend/004-chat-shell/spec.md) AC7 (Settings token field) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

A second real channel for ALMA, "same shape as `services/frontend` but
talking to Telegram instead of a browser" (`CLAUDE.md`'s existing roadmap
description). Two jobs: (1) forward the user's Telegram messages to
`orchestrator`'s existing `/api/inquire` and reply with its answer, and (2)
receive a push request from `scheduler` and deliver a fired reminder for
real. Port **30023** (`docs/ports.md`, already reserved).

## 2. User Story & Acceptance Criteria

**As the user**, I create one Telegram bot (via @BotFather, once), paste its
token into ALMA's Settings, message it, and it's ALMA — same memory as the
web, and it's also how my scheduled reminders actually reach me.

- **AC1**: `POST /config` (called by `frontend/004-chat-shell` AC7's
  Settings field) accepts `{ botToken: string }`, persists it (via
  `knowledge-store` directly — §4), and starts long-polling Telegram with
  that token. No token configured → the service runs (health check
  responds) but does nothing else — never crashes on a missing token.
- **AC2** — **superseded 2026-09-17, see tasks.md's Amendments**:
  originally "first-contact binding" (whoever messages first gets bound,
  no matter who). Felix asked directly for an explicit allowlist instead —
  only Telegram **usernames** he configures in Settings can ever get
  bound (Telegram doesn't expose a phone number without the sender
  explicitly sharing their contact card, so username is the identifier,
  not phone number). `TelegramLink.allowedUsernames` defaults to `[]` —
  fails **closed**: nobody is bound, not even a first message, until at
  least one username is configured. Once a `chatId` is bound, behavior is
  unchanged from the original AC2: any other `chat_id` is silently
  ignored, no reply, to avoid leaking that a bot is listening.
- **AC3**: An incoming text message from the bound `chat_id` is forwarded to
  `orchestrator`'s `POST /api/inquire` (same `KAA` header this service
  authenticates with, same as `services/frontend` does) with the
  **remembered `sessionId`** (§4) — the reply's `sessionId` (new, or the
  same one) is what gets remembered for the next message. The assistant's
  reply text is sent back to the user over Telegram.
- **AC4**: `POST /push` (called by `scheduler/001-agendas` AC4, internal
  only — not exposed to the LLM or the frontend) sends `{ text: string }`
  to the bound `chat_id` over Telegram, **and** appends it as an `ASSISTANT`
  message to the remembered session via `knowledge-store` directly — a
  delivered reminder shows up in the web UI's chat history too, not just on
  the phone (`docs/context.md`'s "memoria unificada" decision, AC6 there).
  Returns delivery success/failure to the caller (`scheduler` records it,
  spec AC4/AC5 there).
- **AC5**: Long-polling (not a webhook) — no public HTTPS endpoint required,
  consistent with this being a self-hosted, no-external-infra setup.

## 3. Session continuity (extends `knowledge-store/003-chat-sessions`)

`telegram-bot` keeps **one** "current session" pointer (persisted, §4 —
survives a service restart) rather than a per-Telegram-conversation
session picker (Telegram has no UI concept matching the web sidebar).
Both AC3 (reply) and AC4 (push) read/update that same pointer — this is
what makes "hablé por Telegram, seguí en la web" work: it's genuinely the
same `ChatSession` row either channel can open.

## 4. Data & config

```prisma
// knowledge-store/prisma/schema.prisma — new model, owned there (not
// services/telegram-bot itself — no service besides knowledge-store
// touches Prisma, ADR-0001's rule holds)
model TelegramLink {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  botToken          String
  chatId            String?  // null until first-contact binding (AC2)
  currentSessionId  String?  // the pointer §3 describes
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

New `knowledge-store` endpoints: `PUT /telegram-link` (upsert token,
`AC1`), `GET /telegram-link` (read config + bound `chatId`/session pointer
on service startup), `PATCH /telegram-link` (update `chatId`/
`currentSessionId` as they change). `services/telegram-bot` calls these
directly — same ADR-0002 reasoning extended to a second caller: this is
channel-plumbing, not LLM-reasoning content.

## 5. Defaults & Assumptions (mark any correction inline)

1. **`botToken` stored in plaintext in Postgres** — same trust model as
   every other secret in this local-only, single-user, no-auth system
   (`docs/context.md`'s no-auth decision). Not encrypted at rest this
   round; revisit if ALMA ever runs anywhere but Felix's own machine.
2. **Un-configuring/rotating the token** (clearing `botToken`, stopping
   polling) isn't specced in detail — `PUT /telegram-link` with a new token
   is assumed to just restart polling with the new one; an explicit
   "disconnect" action is future work if it turns out to be needed.

## 6. Out of Scope — Future Work

- Webhook mode (AC5 — long-polling only this round).
- Multiple bound Telegram accounts (still single-user).
- Rich message formatting/attachments beyond plain text.
- WhatsApp (separate future service, `whatsapp-bot`, same shape).

## 7. Open Questions — resolved 2026-09-17

- **OQ1 — Linking mechanism** → **First-contact binding** (AC2), confirmed
  over manually copying a `chat_id`.
- **OQ2 — Session continuity across channels** → **Shared/unified** (§3),
  confirmed — see `knowledge-store/003-chat-sessions` §8 OQ2 for the
  cross-reference.
