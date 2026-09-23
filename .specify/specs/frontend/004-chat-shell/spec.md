# Spec — Chat shell: sessions sidebar + tab navigation

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | frontend |
| **Depends on** | [`knowledge-store/003-chat-sessions`](../../knowledge-store/003-chat-sessions/spec.md) (session CRUD), existing `frontend/003-explorer` (reused as a tab, not rebuilt) |
| **Constitution clauses in play** | I, III (Vitest for `lib/`/`actions/`), IV, V (dormant) |

## 1. Goal

Replace today's fixed two-panel layout (`main-layout`: chat left, explorer
right, both always visible, no session concept) with the shape every
ChatGPT/Claude-style app uses: a persistent left sidebar listing past
conversations (new chat, delete chat, switch between them) plus a large
chat pane — and, separately, top-level navigation between four other
screens (**Explorar archivos**, **Settings**, **Agendas**, **Agentes y
Skills**) that aren't part of the chat/sidebar pair at all.

**Must follow [`alma-frontend-convention`](../../../../.claude/skills/alma-frontend-convention/skill.md)**
— every token/color/spacing/radius used here comes from that skill's table;
this spec doesn't invent new visual language.

## 2. Layout, confirmed 2026-09-17

- **Two-level navigation, not one.** A slim top-level nav (or a persistent
  header) switches between **Chat** and the four tabs. **Chat** is the
  default view and the only one that shows the sessions sidebar — the
  sidebar is part of the Chat view, not a global element that stays visible
  on `Agendas`/`Settings`/etc. Confirmed: the other four screens are
  full-width, standalone (matches how `frontend/003-explorer`'s
  `ExplorerPanel` already works today — it doesn't need a chat sidebar next
  to it to make sense).
- **Chat view**: left column = sessions sidebar (list, "nuevo chat" button,
  per-item delete), right column = the chat pane (large, single active
  session, composer at the bottom) — same shape `ChatPanel`/`MessageBubble`
  already have, now driven by a `sessionId` instead of local-only state.

## 3. User Story & Acceptance Criteria

**As the user**, I open ALMA and see my past conversations in a sidebar; I
can start a new one, delete an old one, or click back into any of them and
keep talking — and I can navigate to Explorar archivos / Settings / Agendas
/ Agentes y Skills without losing that.

- **AC1**: On load, the sidebar lists all sessions from `GET /chat-sessions`
  (title, or "Nueva conversación" while `title` is still `null` — see
  `knowledge-store/003-chat-sessions` AC4), most recently active first.
- **AC2**: "Nuevo chat" clears the chat pane to empty and clears the active
  `sessionId` — the next message sent creates a session server-side
  (`knowledge-store/003-chat-sessions` AC7's `sessionId`-omitted path), which
  then gets inserted at the top of the sidebar list.
- **AC3**: Clicking a sidebar item loads that session's full message history
  (`GET /chat-sessions/:id`) into the chat pane and makes it the active
  session — the next message sent continues it (`sessionId` included in the
  `/api/inquire` call).
- **AC4**: A delete action per sidebar item (icon/button, not a full-row
  click target — same "don't hide destructive actions behind an ambiguous
  click" instinct as everywhere else in this design system) calls
  `DELETE /chat-sessions/:id` and removes it from the list. If the deleted
  session was the active one, the chat pane clears to the "nuevo chat"
  empty state (AC2's state), not a blank crash.
- **AC5**: The four tabs (**Explorar archivos**, **Settings**, **Agendas**,
  **Agentes y Skills**) are reachable from anywhere, and switching to one
  and back to Chat preserves the active session (no re-fetch flicker on
  return — session state lives above the tab switch, not inside the Chat
  view's own mount lifecycle).
- **AC6**: **Explorar archivos** is the existing `ExplorerPanel` moved into
  a tab — no behavior change, this spec only relocates it in the layout.
- **AC7**: **Settings** is a mostly-mock screen (placeholder sections for
  WhatsApp, Telegram, etc. with no backing functionality) **except the
  Telegram field, which is real**: a token input that actually saves and
  activates `services/telegram-bot` (confirmed 2026-09-17 — see
  `telegram-bot/001-channel` for what "saves" means concretely; this spec
  only owns the input field and its call to that service).
- **AC8**: **Agendas** lists the current user's reminders
  (`services/scheduler`'s list endpoint, `scheduler/001-agendas`) — read
  view only in this spec; creating a reminder happens through chat
  (`scheduleReminder` MCP tool), not a form here, this iteration.
- **AC9**: **Agentes y Skills** lists/creates/edits `Agent` presets
  (`orchestrator/002-multi-agent`'s `Agent` CRUD) — name, system-prompt
  addendum, which MCP tools and skills it can use.

## 4. Directory layout (extends `docs/conventions/frontend.md`)

```
services/frontend/src/
├── app/
│   ├── page.tsx                     # now just the Chat view (sidebar + pane)
│   ├── explorer/page.tsx            # new route, renders existing ExplorerPanel
│   ├── settings/page.tsx            # new route
│   ├── agendas/page.tsx             # new route
│   └── agents/page.tsx              # new route
├── components/
│   ├── shell/
│   │   ├── AppNav.tsx               # the Chat/Explorar/Settings/Agendas/Agentes switcher
│   │   └── SessionSidebar.tsx       # new chat / list / delete
│   ├── chat/                        # existing, ChatPanel gains sessionId prop/state
│   ├── explorer/                    # existing, unchanged (AC6)
│   ├── settings/                    # new (mock sections + real Telegram field)
│   ├── agendas/                     # new (read-only list)
│   └── agents/                      # new (CRUD)
├── actions/
│   ├── list-chat-sessions.ts        # new
│   ├── get-chat-session.ts          # new
│   ├── delete-chat-session.ts       # new
│   ├── list-agendas.ts              # new
│   ├── save-telegram-token.ts       # new
│   └── (agents CRUD actions)        # new
```

## 5. Out of Scope — Future Work

- Renaming a session manually (`knowledge-store/003-chat-sessions` §7).
- Creating/editing reminders from the Agendas tab UI (chat-only this
  iteration, AC8).
- A real (non-mock) WhatsApp settings section — `whatsapp-bot` isn't built.
- Mobile-responsive layout beyond what already applies repo-wide (no new
  breakpoint work scoped here).

## 6. Open Questions — resolved 2026-09-17

- **OQ1 — Sidebar global or Chat-only?** → **Chat-only** (§2).
- **OQ2 — Settings real vs mock?** → **Mock except the Telegram field**
  (AC7).

## 7. Defaults & Assumptions (not confirmed in the interview — mark any correction inline)

- **AC8/AC9's split (Agendas read-only + chat-only creation, vs. Agentes y
  Skills with full CRUD from the tab) is this spec's own default, not
  something explicitly asked.** Reasoning: a reminder is naturally one
  sentence ("todos los días a las 15:30, recordame X"), so a chat-only
  creation path costs nothing extra; an `Agent` is structured config (name +
  tool list + skill list) that a form suits better than dictating it in
  chat. **Flagging this explicitly since it decides real scope** (a full
  Agent CRUD form vs. a read-only list) — correct it here if that's wrong
  before `plan.md`/`tasks.md` build against it.
