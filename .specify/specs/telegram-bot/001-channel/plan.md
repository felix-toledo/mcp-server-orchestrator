# Plan — Telegram channel

Base: [`spec.md`](./spec.md). New service, thin — most of its job is
translating between the Telegram Bot API and `orchestrator`'s existing
`/api/inquire`.

## 1. Folder structure

```
services/telegram-bot/
├── src/
│   ├── index.ts                     # composition root: KnowledgeStoreClient, bot instance (grammy)
│   ├── core/server.ts                # createApp(deps) — /health, /config, /push
│   ├── bot/
│   │   └── telegramBot.ts            # grammy Bot wrapper: start/stop polling, onMessage handler
│   ├── services/
│   │   └── channelService.ts         # AC2 (binding), AC3 (forward to orchestrator), AC4 (push + log)
│   └── infrastructure/
│       ├── knowledgeStoreClient.ts    # direct HTTP to knowledge-store, ADR-0002 pattern (3rd caller of this pattern now)
│       └── orchestratorClient.ts      # HTTP client for POST /api/inquire, mirrors services/frontend's
├── .env.example
├── package.json
└── tsconfig.json
```

`.env`: `PORT=30023`, `KNOWLEDGE_STORE_URL`, `ORCHESTRATOR_URL`,
`KEY_ALLOWED_AGENTS` (same `KAA` value as `orchestrator`/`frontend`'s —
this service authenticates to `orchestrator` as another calling
channel/agent, per `CLAUDE.md`'s existing multi-channel `KAA` model). No
`TELEGRAM_BOT_TOKEN` env var — the token lives in `knowledge-store`
(`TelegramLink`, AC1), fetched on startup and whenever `PUT /telegram-link`
changes it.

**Library**: `grammy` (actively maintained, TypeScript-first Telegram Bot
API client) — chosen over `node-telegram-bot-api` for that reason, not
re-litigated further here (a low-stakes library pick, not a business rule).

## 2. `ChannelService`

```typescript
export class ChannelService {
  constructor(
    private readonly knowledgeStoreClient: KnowledgeStoreClient,
    private readonly orchestratorClient: OrchestratorClient,
  ) {}

  // AC2 — called from telegramBot.ts's onMessage before anything else
  async resolveBoundChat(incomingChatId: string): Promise<{ isBound: boolean }>;

  // AC3 — the full incoming-message flow
  async handleIncomingMessage(text: string): Promise<string>; // returns the reply text to send back

  // AC4 — scheduler's push
  async pushMessage(text: string): Promise<{ delivered: boolean }>;
}
```

`handleIncomingMessage`: reads `currentSessionId` from
`knowledgeStoreClient.getTelegramLink()`, calls
`orchestratorClient.inquire({ messages: [...], sessionId })`, persists the
returned `sessionId` back via `knowledgeStoreClient.updateTelegramLink({
currentSessionId })` if it changed (first message ever, or session was
deleted from the web UI in the meantime — treated as "start a new one," not
an error).

`pushMessage`: sends via the `grammy` bot instance directly (not through
`orchestrator` — this is ALMA speaking proactively, not answering a
question, so there's no LLM call in this path at all, matching
`scheduler/001-agendas` §7.1's "no LLM call at fire time"), then calls
`knowledgeStoreClient.appendChatMessage(currentSessionId, 'ASSISTANT',
text)` — same direct-HTTP pattern ADR-0002 already established, this
service's second use of it (`knowledge-store/003-chat-sessions` was the
first).

## 3. `telegramBot.ts`

```typescript
export function startPolling(bot: Bot, deps: { channelService: ChannelService }): void;
export function stopPolling(bot: Bot): Promise<void>;
```

`onMessage` handler: `resolveBoundChat` first (AC2 — silently drops
messages from an unbound `chat_id` once one is already bound); then
`handleIncomingMessage`, then `bot.api.sendMessage(chatId, reply)`.

`index.ts` startup: fetch the current `TelegramLink` config from
`knowledge-store`; if a `botToken` exists, construct the `Bot` and call
`startPolling`; if not, skip — the HTTP server (`/health`, `/config`,
`/push`) still starts either way (spec AC1's "runs, does nothing" case).
`POST /config` (below) calls `stopPolling` + rebuilds + `startPolling` with
the new token if one was already running.

## 4. `core/server.ts` routes

```typescript
app.get('/health', ...);
app.put('/config', configController.save);   // AC1 — { botToken } → knowledgeStoreClient.upsertTelegramLink, (re)start polling
app.post('/push', pushController.push);      // AC4 — { text } → channelService.pushMessage
```

## 5. Design patterns applied

- **Service Layer**: `ChannelService` holds all the binding/forwarding/push
  logic — the `grammy` handler and the Express controllers both stay thin.
- **Dependency Injection**: both HTTP clients constructed once in
  `index.ts`, injected into `ChannelService`.

## 6. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `ChannelService.resolveBoundChat` | AC2 — first message binds, second `chat_id` after that is rejected |
| `ChannelService.handleIncomingMessage` | AC3 — session pointer read/updated correctly, `orchestratorClient` called with the right `KAA`/body shape |
| `ChannelService.pushMessage` | AC4 — sends via bot, logs via `knowledgeStoreClient`, returns delivery status on failure without throwing |
| `core/server.test.ts` (supertest) | `/config` and `/push` status codes, mocked `ChannelService` |

`telegramBot.ts`'s `grammy` wiring itself gets no dedicated test (thin
adapter over a third-party polling loop, not business logic) — same
documented-gap pattern `mcp-server`'s tool files used before `mcp-server`
got full Vitest coverage; here it's a deliberate, permanent exception for
this one file, not a temporary gap.

## 7. Build order (→ `tasks.md`)

1. `knowledge-store`: `TelegramLink` schema + endpoints (spec §4) — this is
   a `knowledge-store` change, done here since this spec owns that model.
2. Scaffold `services/telegram-bot` (package/tsconfig/vitest,
   `.env.example`, `grammy` dependency).
3. `knowledgeStoreClient.ts` + `orchestratorClient.ts` + tests.
4. `ChannelService` + tests (§2).
5. `telegramBot.ts` (`grammy` wiring, §3) — no dedicated test, manual
   verification only.
6. `core/server.ts` routes + `index.ts` startup logic + tests.
7. Root `package.json`: `dev:telegram-bot`/`build:telegram-bot`/
   `start:telegram-bot`. `docs/ports.md` row flips `planned` → `active`.
8. Manual end-to-end: create a real bot via @BotFather, paste the token
   into Settings, message it, confirm the reply and that the same
   conversation is visible from the web UI.
