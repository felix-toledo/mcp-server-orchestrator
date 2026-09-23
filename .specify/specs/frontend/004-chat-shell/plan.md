# Plan — Chat shell: sessions sidebar + tab navigation

Base: [`spec.md`](./spec.md). Follows [`docs/conventions/frontend.md`](../../../../docs/conventions/frontend.md)
and **must** apply [`alma-frontend-convention`](../../../../.claude/skills/alma-frontend-convention/skill.md)
tokens/components throughout — no ad hoc color/spacing.

## 1. Routing

App Router gains 4 routes alongside the existing `/` (now Chat-only) and
`/onboarding`: `/explorer`, `/settings`, `/agendas`, `/agents`. `AppNav`
(new, `components/shell/AppNav.tsx`) renders on every one of these 5 routes
via a shared layout segment (`app/(shell)/layout.tsx` — Next.js route group,
keeps `/onboarding` outside it since onboarding has no nav).

## 2. Chat view (`app/(shell)/page.tsx`)

```typescript
// Server Component: fetch initial session list server-side
const sessions = await listChatSessions(); // actions/list-chat-sessions.ts

<div className="chat-shell">
  <SessionSidebar initialSessions={sessions} />
  <ChatPanel /> {/* now takes no initialEntries-like prop; manages its own active session client-side */}
</div>
```

`SessionSidebar` (Client Component, `components/shell/SessionSidebar.tsx`):
own `activeSessionId` state, lifted to a shared context
(`components/shell/ChatSessionContext.tsx`, new — small, just
`{ activeSessionId, setActiveSessionId, sessions, refreshSessions }`) so
`ChatPanel` (a sibling, not a child) can read/react to session switches
without prop-drilling through `page.tsx`.

`ChatPanel` changes: on `activeSessionId` change, fetches
`GET /chat-sessions/:id` (via `getChatSession` action) and replaces its
local `messages` state; on send, includes `sessionId: activeSessionId ??
undefined` in the `/api/inquire` call body and, if the response returns a
new `sessionId` (session was just created), calls
`setActiveSessionId`+`refreshSessions()` from the context.

## 3. New Server Actions (`actions/`)

```typescript
// list-chat-sessions.ts
export async function listChatSessions(): Promise<ChatSessionSummary[]>; // GET /chat-sessions

// get-chat-session.ts
export async function getChatSession(id: string): Promise<ChatSessionDetail | null>; // GET /chat-sessions/:id

// delete-chat-session.ts
export async function deleteChatSession(id: string): Promise<{ ok: boolean }>; // DELETE /chat-sessions/:id
```

All three call `knowledgeStoreClient` (existing
`lib/knowledge-store-client.ts`, gains the matching methods) — same
ADR-0001 pattern the explorer/onboarding actions already use (frontend
talks to `knowledge-store` directly for non-chat data; chat itself still
goes through `orchestrator`'s `/api/inquire`, now carrying `sessionId`).

## 4. Tabs

- **`/explorer`**: `app/(shell)/explorer/page.tsx` renders the existing
  `ExplorerPanel` unchanged (AC6) — this file replaces `ExplorerPanel`'s
  current mount point in the old `page.tsx`, no component code changes.
- **`/settings`**: `components/settings/SettingsPanel.tsx` — static mock
  sections (WhatsApp, etc., `card--empty`-styled placeholders per the design
  system) plus one real field (Telegram token) wired to a new
  `actions/save-telegram-token.ts` Server Action that `POST`s to
  `services/telegram-bot`'s config endpoint (`telegram-bot/001-channel`
  §4).
- **`/agendas`**: `components/agendas/AgendaList.tsx` — read-only list from
  a new `actions/list-agendas.ts` (`GET` to `services/scheduler`).
- **`/agents`**: `components/agents/AgentList.tsx` + `AgentForm.tsx` — CRUD
  against `orchestrator/002-multi-agent`'s `Agent` endpoints (owned by
  `knowledge-store`, per that spec's §4 — actions call
  `knowledge-store` directly, same ADR-0001 pattern).

## 5. Design patterns applied

- No new pattern beyond what `docs/conventions/frontend.md` already
  prescribes (Server Components by default, `"use client"` only on the
  interactive leaves — `SessionSidebar`, `ChatPanel`, `AgentForm`).
- `ChatSessionContext` is the one piece of shared client state this spec
  introduces — justified because `SessionSidebar` and `ChatPanel` are
  siblings that both need `activeSessionId`, not because "context" is a
  default reach.

## 6. Test strategy (Vitest — `lib/`/`actions/` only, per this repo's
frontend testing convention; no jsdom/component-render tests)

| Target | Covers |
|---|---|
| `lib/knowledge-store-client.ts`'s new methods | request shape, response parsing |
| `actions/list-chat-sessions.ts`, `get-chat-session.ts`, `delete-chat-session.ts` | mocked client, happy path + not-found |
| `actions/save-telegram-token.ts`, `list-agendas.ts` | mocked `fetch`/client |

`e2e/` (Playwright) gains coverage for the sidebar flow (new chat → send →
appears in list → switch away and back → delete) once the mock backend
(`e2e/mock-backend.js`) supports the new endpoints — a task in `tasks.md`,
not assumed free.

## 7. Build order (→ `tasks.md`)

1. `knowledge-store` client methods + actions for sessions (§3).
2. `ChatSessionContext` + `SessionSidebar` + `AppNav` + shell layout (§1–2).
3. Wire `ChatPanel` to `activeSessionId` (§2).
4. `/explorer` route (relocate only, AC6).
5. `/settings` route (mock + Telegram field, needs `telegram-bot/001-channel`
   to exist for the real save to work end to end — the field can be built
   and merged before that spec ships, calling a not-yet-live endpoint).
6. `/agendas` route (needs `scheduler/001-agendas`'s list endpoint).
7. `/agents` route (needs `orchestrator/002-multi-agent`'s `Agent` CRUD).
8. `e2e/mock-backend.js` + Playwright spec for the sidebar flow.
