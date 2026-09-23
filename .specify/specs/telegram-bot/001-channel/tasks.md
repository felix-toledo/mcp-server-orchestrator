# Tasks — Telegram channel

Base: [`plan.md`](./plan.md) §7. Depends on
`knowledge-store/003-chat-sessions` for shared sessions.

- [x] **T1 — `knowledge-store`: `TelegramLink` schema + endpoints**: the
  Prisma model already existed (landed in the same combined migration as
  `Agent`/`VaultFolder` — see `knowledge-store/004`'s tasks.md T1).
  Added `TelegramLinkService` (`upsert`/`get`/`updateBinding`),
  `telegramLinkController`, `PUT`/`GET`/`PATCH /telegram-link` (spec §4).
  spec §5.2: rotating the token via `upsert` preserves the existing
  `chatId`/`currentSessionId` — only a brand-new link starts with both
  `null`. Tests: 10 in `telegramLinkService.test.ts` + `server.test.ts`.
- [x] **T2 — Scaffold `services/telegram-bot`**: package/tsconfig/vitest,
  `.env.example`, `grammy` dependency (no Prisma of its own — this service
  never touches a database directly, ADR-0001's rule).
- [x] **T3 — HTTP clients**: `knowledgeStoreClient.ts` (`TelegramLink`
  CRUD + `appendChatMessage`, third caller of ADR-0002's direct-HTTP
  pattern), `orchestratorClient.ts` (near-identical to
  `services/frontend`'s own, per plan.md §1). Tests: 8 total.
- [x] **T4 — `ChannelService`**: `resolveBoundChat` (AC2),
  `handleIncomingMessage` (AC3), `pushMessage` (AC4). **Deviation from
  plan.md §2's constructor signature**: the plan only lists
  `knowledgeStoreClient`/`orchestratorClient`, but `pushMessage`'s own doc
  text says it "sends via the grammy bot instance directly" — that needs
  *some* reference to the bot, which two HTTP clients can't provide.
  Added a third injected dependency, a small `TelegramSender` interface
  (`{ sendMessage(chatId, text) }`) instead of a raw `grammy` `Bot`, so the
  service stays unit-testable and doesn't go stale when `/config` rebuilds
  the bot. Tests: 9 in `channelService.test.ts`.
- [x] **T5 — `telegramBot.ts`**: `grammy` wiring, `startPolling`/
  `stopPolling`, `createTelegramSender`. No dedicated test (plan §6,
  deliberate exception) — exercised live in T8 below instead.
  **Not in plan.md's file tree**: `core/telegramRuntime.ts` — the live
  `Bot`/`ChannelService` pair is genuinely dynamic (absent until `/config`,
  then rebuilt on every token change per spec §5.2), and both `/config`
  (rebuild) and `/push` (use whatever's currently live) need to reach the
  *same* instance without either route holding a reference that goes
  stale. A small owning class was the natural place for that, not
  something either the plan's tree or its 2-file `bot/`+`services/` split
  anticipated.
- [x] **T6 — `core/server.ts` + `index.ts`**: `/health`, `/config`, `/push`
  routes (thin, delegate to `TelegramRuntime`); startup reads the existing
  `TelegramLink` config and starts polling if a token is already saved,
  fails open (logs, doesn't crash) if `knowledge-store` isn't reachable
  yet. Same `asyncHandler` + final error middleware pattern as the other
  two backend services. Tests: 7 in `server.test.ts`, including the
  unhandled-rejection-returns-500 regression.
- [x] **T7 — Wiring scripts**: root `package.json` gains
  `dev:telegram-bot`/`build:telegram-bot`/`start:telegram-bot`,
  `docs/ports.md` row flips `planned` → `active`.
- [x] **T8 — Manual end-to-end**: fully verified live with a real
  @BotFather token Felix provided mid-session (`@almadev_bot`).
  Pre-token checks (unchanged from the earlier partial pass): `/health`
  responds with no token configured, an invalid token fails `getMe` with
  a real `401` from Telegram without crashing the process, `POST /push`
  with no `chatId` bound returns `{ delivered: false }` (AC4/AC5).
  **With the real token**: AC2's first-contact binding — the first real
  Telegram message bound `chatId` and created a `ChatSession` in one
  shot; AC3 — a follow-up message correctly reused the same session
  (`currentSessionId` unchanged) and got a real LLM reply back over
  Telegram; §3 — confirmed the exact same `ChatSession` row (read
  directly via `knowledge-store`) holds both turns, proving cross-channel
  continuity by construction (one shared table, no separate code path for
  "the web UI's version"). `scheduler/001-agendas` AC4's real push path:
  a 5-second one-off reminder fired and delivered for real
  (`lastDeliveryStatus: DELIVERED`), and the pushed text showed up
  appended to the same chat session. Went further than the spec's own
  script: asked the bot naturally in Telegram ("me harias acordar algo en
  2 minutos? que me vaya con estela") and the **entire pipeline** worked
  unprompted — orchestrator → `scheduleReminder` tool call → correct
  ~2-minute-out timestamp → fired on time → delivered over real Telegram.
  **Real bug found and fixed live, not from a test**: reconfiguring
  `/config` from a bot whose *first* `start()` attempt had already failed
  (the earlier invalid-token test) produced no further log output at all
  on a second `PUT /config` with a valid token — looked like the rebuild
  silently did nothing, even after a 25-second wait. Root cause not fully
  isolated (grammy's `withRetries`/`bot.stop()` interaction with a bot
  that never successfully initialized is opaque from the outside), but a
  **plain process restart** picked up the valid token from
  `knowledge-store` cleanly on boot with zero errors. Confirmed
  separately that `/config` reconfiguring an **already-healthy** bot (the
  realistic "I'm rotating my token" case, not "recovering from a bad
  one") works cleanly in-process, no restart needed — verified by
  re-`PUT`-ting the same working token and then getting a real reply to a
  follow-up Telegram message. Documented here as a known rough edge (bad
  token → good token via `/config` alone may need a restart to fully
  recover) rather than a blocker, since the common path is unaffected.

## Amendments (2026-09-17)

**Real bug found live by Felix**: the LLM had no memory of anything said
in a Telegram conversation, including a reminder `pushMessage` had just
delivered into the same session. Root cause: `orchestrator`'s
`/api/inquire` never reloads history from `sessionId` server-side — that
field is only for `knowledge-store` persistence, the *caller* resends the
whole conversation every time (`frontend`'s own chat client already does
this correctly). `ChannelService.handleIncomingMessage` only ever sent the
latest message. **Fixed**: added `KnowledgeStoreClient.getChatSessionMessages`
and load the full session history (mapped from `knowledge-store`'s
UPPERCASE roles to the lowercase ones `orchestrator` expects) before every
`inquire` call. Tests added, including one asserting a previously-pushed
reminder is present in the messages sent on the next turn.

**AC2 replaced — allowlist instead of first-contact binding**: Felix
explicitly asked that only Telegram accounts he configures can talk to the
bot, not whoever messages it first. Telegram's Bot API doesn't expose a
user's phone number without them sharing their contact card explicitly, so
the allowlist is by **username** (confirmed with Felix directly), not
phone number. `TelegramLink.allowedUsernames` (new `Json`, default `[]` —
fails closed, nobody gets bound until at least one is configured) is
checked in `resolveBoundChat` before binding a new `chatId`; an
already-bound `chatId` keeps working exactly as before regardless of
username (a bound chat is already proven, re-checking would just be
theater). `ChannelService.resolveBoundChat`'s signature gained a second
`incomingUsername: string | undefined` parameter,
`telegramBot.ts` passes `ctx.from?.username`.

**Settings UX fix**: the frontend always showed an empty "enter your
token" form and had no link back to the bot, regardless of whether one
was already configured — found live by Felix. Added `GET /status`
(`{configured, botUsername, chatId, allowedUsernames}` — never the raw
token) backed by a new `TelegramRuntime.getBotUsername()` (reads grammy's
`bot.botInfo`, defensively `try/catch`-wrapped since that getter can throw
before the bot's own async `init()` — triggered inside `start()`, never
awaited — has actually finished). The Settings page now renders a
"Conectado" state with a real `t.me/<username>` link and a server-generated
QR code (`qrcode` npm package, SVG rendered inline) instead of always
re-prompting for the token, plus an always-editable allowlist input that
updates via `knowledge-store`'s `PATCH /telegram-link` directly (not
`telegram-bot`'s `/config` — editing the allowlist needs no bot
restart, and the frontend never has the raw token to resend anyway).
Verified live: `/status` correctly reports the already-connected bot
without ever leaking the token, and a normalized allowlist entry
round-trips correctly end to end (input → `knowledge-store` → `/status`
→ rendered page).
