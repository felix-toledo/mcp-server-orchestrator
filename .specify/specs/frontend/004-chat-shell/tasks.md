# Tasks — Chat shell: sessions sidebar + tab navigation

Base: [`plan.md`](./plan.md) §7. Depends on `knowledge-store/003-chat-sessions`
being implemented first (T1 below needs its endpoints live).

- [x] **T1 — `knowledge-store` client + session actions**: `lib/knowledge-store-client.ts`
  gains session methods; `actions/list-chat-sessions.ts`,
  `get-chat-session.ts`, `delete-chat-session.ts`. Tests per plan §6.
- [x] **T2 — Shell scaffolding**: `app/(shell)/layout.tsx`, `AppNav.tsx`,
  `ChatSessionContext.tsx`, `SessionSidebar.tsx`.
- [x] **T3 — Wire `ChatPanel` to sessions**: active-session load on switch,
  `sessionId` included in `/api/inquire` calls, new-session response
  updates context + sidebar (AC1–AC4). Verified live via Playwright: sent a
  message with no active session, a new session appeared in the sidebar
  with an auto-generated title, reply rendered correctly.
- [x] **T4 — `/explorer` route**: relocate `ExplorerPanel` (AC6) — done as
  part of `frontend/005-vault-editor`'s rewrite of that panel (folders/TipTap
  landed at the same time, not staged separately — see that spec's tasks).
- [x] **T5 — `/settings` route**: mock sections + Telegram token field +
  `save-telegram-token.ts` action (AC7). The real save still 404s/fails
  until `telegram-bot/001-channel` exists — verified it fails gracefully
  (shows an inline error, doesn't crash the page) rather than assuming success.
- [x] **T6 — `/agendas` route**: read-only list (AC8), built against
  `scheduler/001-agendas`'s documented (not yet live) endpoint — `list-agendas.ts`
  fails open to an empty list, verified live (renders the empty state
  cleanly with `scheduler` not running yet).
- [x] **T7 — `/agents` route**: CRUD list + form (AC9), built against
  `orchestrator/002-multi-agent`'s documented (not yet live) `Agent`
  endpoints — same fail-open pattern as T6.
- [ ] **T8 — E2E**: extend `e2e/mock-backend.js` for chat-session endpoints,
  Playwright spec for new chat → send → switch → delete. Not done yet —
  manual Playwright verification substituted for this round (screenshots +
  a live interaction script, not a committed spec file); the real
  `e2e/mock-backend.js` coverage is still open.

**Real UI bug found and fixed during manual verification**: nav links
(`AppNav.tsx`) rendered with a browser-default underline on every item
except the active one (the active pill's background just happened to hide
it) — `a { color: var(--accent) }` in `globals.css` never reset
`text-decoration`. Fixed: `.app-nav__item { text-decoration: none; }`.
