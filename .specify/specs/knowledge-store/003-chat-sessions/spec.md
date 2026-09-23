# Spec — Chat session persistence

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (`services/knowledge-store` owns the data; `services/orchestrator` calls it directly, see ADR-0002) |
| **Depended on by** | [`frontend/004-chat-shell`](../../frontend/004-chat-shell/spec.md) (session list/switch/delete UI), [`orchestrator/001-reasoning-pipeline`](../../orchestrator/001-reasoning-pipeline/spec.md) (persists each turn), [`telegram-bot/001-channel`](../../telegram-bot/001-channel/spec.md) (shares the same sessions) |
| **Constitution clauses in play** | I, III (Vitest), IV (layering/DI), V (dormant) |

## 1. Goal

Chat today has no memory of itself: `services/frontend`'s `ChatPanel` keeps
`messages` in React state and nothing is ever written to a database —
refresh the page and it's gone, and there's no way to have more than one
conversation. This spec gives ALMA **persisted, listable, deletable
conversation threads** (`ChatSession` + `ChatMessage`) — the foundation
`frontend/004-chat-shell`'s sidebar needs ("nuevo chat," "borrar chat,"
switch between past ones) and the storage `orchestrator/001-reasoning-pipeline`
appends every turn to.

## 2. Why `knowledge-store`, and why `orchestrator` calls it directly

Same reasoning as `001-vectorization`: one service owns the Postgres
connection. `services/orchestrator` gets a `KnowledgeStoreClient`-shaped
HTTP client of its own (different service, different `KNOWLEDGE_STORE_URL`
env var already) and calls `knowledge-store` **directly**, not through an
MCP tool — see [ADR-0002](../../../../docs/adr/0002-orchestrator-calls-knowledge-store-directly-for-sessions.md)
for why this is a different case than `002-retrieval`'s hidden-tool
approach.

## 3. User Story & Acceptance Criteria

**As the orchestrator, acting on ALMA's behalf**, every chat turn belongs to
a session; I create one if the caller didn't say which, append both sides of
the exchange to it, and let the user list/open/delete their sessions from
the frontend.

- **AC1**: `POST /chat-sessions` creates a new, empty session (`{ id, title,
  createdAt, updatedAt }`, `title` starts `null` — see AC4) for the current
  `User`.
- **AC2**: `GET /chat-sessions` returns all of the current `User`'s
  sessions, `{ id, title, updatedAt }[]`, sorted `updatedAt` desc (most
  recently active first — same ordering convention as
  `GET /knowledge-entries`).
- **AC3**: `GET /chat-sessions/:id` returns `{ id, title, createdAt,
  updatedAt, messages: [{ id, role, content, createdAt }] }`, messages in
  chronological order. `404` if the session doesn't exist (or belongs to a
  different user, though single-user makes that moot this iteration).
- **AC4**: `POST /chat-sessions/:id/messages` appends one message (`{ role:
  'user' | 'assistant' | 'tool', content: string }`) and bumps the
  session's `updatedAt`. **The first `user` message appended to a session
  with `title: null` auto-generates the title** — a plain-text truncation of
  that message (same `plainTextExcerpt` helper `knowledge-store` already
  has for `KnowledgeEntry.summary`, reused rather than re-implemented,
  confirmed 2026-09-17: no LLM call needed just to title a chat).
- **AC5**: `DELETE /chat-sessions/:id` hard-deletes the session and all its
  messages (`onDelete: Cascade`) — confirmed 2026-09-17: unlike
  `KnowledgeEntry` (which nothing in this codebase deletes at all yet), a
  chat session the user explicitly deletes is gone, not archived. This is
  a different retention rule than `context-extended.md`'s "Logs de
  conversaciones" concept (indefinite retention, user-filterable) — that's
  a different, still-unscoped table (see `docs/context.md`'s note on this),
  not what this spec builds.
- **AC6**: Sessions are **not** scoped to a channel. `ChatMessage` has no
  `channel` column. `telegram-bot/001-channel` and `services/frontend` both
  read/write the exact same sessions for the one `User` — confirmed
  2026-09-17 ("memoria unificada").
- **AC7**: `orchestrator`'s `/api/inquire` request body gains an optional
  `sessionId`. If given, that session's row is what gets appended to (and
  `404`s bubble up as a normal error if it doesn't exist). If omitted, the
  orchestrator calls `POST /chat-sessions` itself to create one, and
  **returns the new `sessionId` in the response** so the caller (frontend or
  `telegram-bot`) can persist it for the next turn. This is `orchestrator`
  calling `knowledge-store` directly (§2), not a new MCP tool.
- **AC8**: A failure to persist (session/message write fails) **does not
  block the chat reply** — the user still gets their answer even if history
  couldn't be saved that turn. Matches the same fail-open philosophy
  `002-retrieval` AC7 already established for search. Logged, not silently
  eaten — `console.warn`, consistent with the rest of `Orchestrator.ts`.

## 4. `knowledge-store` — new endpoints

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `POST /chat-sessions` | — | `201 { id, title, createdAt, updatedAt }` | AC1 |
| `GET /chat-sessions` | — | `200 [{ id, title, updatedAt }]` | AC2, sorted `updatedAt` desc |
| `GET /chat-sessions/:id` | — | `200 { id, title, createdAt, updatedAt, messages }` or `404` | AC3 |
| `POST /chat-sessions/:id/messages` | `{ role, content }` | `201 { id, role, content, createdAt }` | AC4, `404` if session missing |
| `DELETE /chat-sessions/:id` | — | `204` | AC5, cascades to messages |

## 5. Prisma schema additions

```prisma
model ChatSession {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  title     String?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
}

enum ChatMessageRole {
  USER
  ASSISTANT
  TOOL
}

model ChatMessage {
  id        String          @id @default(cuid())
  sessionId String
  session   ChatSession     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      ChatMessageRole
  content   String
  createdAt DateTime        @default(now())
}
```

No vector column here — chat messages aren't embedded/searched this
iteration (that stays `KnowledgeEntry`'s job; a message becomes searchable
knowledge only if/when the user or ONIROS explicitly promotes it to one,
both out of scope).

## 6. Defaults & Assumptions (mark any correction inline)

1. **Title generation is a plain-text truncation, not an LLM call** — same
   reasoning `001-vectorization` AC4 already established for
   `KnowledgeEntry.summary`. Reused, not reinvented.
2. **No pagination on `GET /chat-sessions`** — fine for one user's realistic
   session count this iteration; add it the day it's actually a problem.
3. **`role` is a Prisma enum** (`USER`/`ASSISTANT`/`TOOL`), matching
   `Purpose`'s existing enum pattern in this schema, rather than a free
   string.

## 7. Out of Scope — Future Work

- Editing/renaming a session's title manually.
- `context-extended.md`'s "Logs de conversaciones" / ONIROS staging table —
  a different, indefinite-retention concept, not this spec's `ChatMessage`.
- Full-text or semantic search over past chat sessions.
- Per-channel session filtering (AC6 explicitly rejects this for now).

## 8. Open Questions — resolved 2026-09-17

- **OQ1 — Is a UI "chat session" the same as `context-extended.md`'s "Logs
  de conversaciones"?** → **No**, confirmed via the interview for
  `orchestrator/001-reasoning-pipeline`'s compressor question: the
  compressor's "memoria de corto plazo" is scoped **in-request-only, not
  persisted** — so this spec's `ChatSession`/`ChatMessage` is the only
  persisted conversation-history concept that exists right now, and it's
  simpler (user-facing history, not ONIROS fodder) than the eventual "Logs"
  table.
- **OQ2 — Shared across channels or per-channel?** → **Shared** ("memoria
  unificada," AC6).
