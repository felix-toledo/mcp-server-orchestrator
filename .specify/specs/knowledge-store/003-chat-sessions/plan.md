# Plan — Chat session persistence

Base: [`spec.md`](./spec.md). Follows [`docs/design-patterns.md`](../../../../docs/design-patterns.md)
and [`docs/conventions/architecture.md`](../../../../docs/conventions/architecture.md).
Contracts below are signatures only.

## 1. Layering

```
knowledge-store: chatSessionsController (transport) → ChatSessionService (business logic) → prisma
orchestrator:     inquireController → KnowledgeStoreClient (new, HTTP, direct — ADR-0002) → knowledge-store
```

## 2. `knowledge-store`

### 2.1 Schema (`src/api/schemas.ts`)

```typescript
export const AppendChatMessageInputSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT', 'TOOL']),
  content: z.string().min(1),
});
export type AppendChatMessageInput = z.infer<typeof AppendChatMessageInputSchema>;
```

(`POST /chat-sessions` and `DELETE /chat-sessions/:id` take no body.)

### 2.2 `ChatSessionService` (`src/services/chatSessionService.ts`)

```typescript
export interface ChatSessionSummary {
  id: string;
  title: string | null;
  updatedAt: Date;
}
export interface ChatSessionDetail extends ChatSessionSummary {
  createdAt: Date;
  messages: Array<{ id: string; role: ChatMessageRole; content: string; createdAt: Date }>;
}

export class ChatSessionService {
  constructor(private readonly prisma: PrismaClient, private readonly userService: UserService) {}

  create(): Promise<ChatSessionSummary & { createdAt: Date }>;                    // AC1
  list(): Promise<ChatSessionSummary[]>;                                          // AC2, updatedAt desc
  getById(id: string): Promise<ChatSessionDetail | null>;                         // AC3
  appendMessage(sessionId: string, input: AppendChatMessageInput): Promise<{...}>; // AC4 — titles on first USER message
  delete(id: string): Promise<void>;                                              // AC5, cascade
}
```

`appendMessage`: if `input.role === 'USER'` and the session's current
`title` is `null`, set `title = plainTextExcerpt(input.content, 60)` (a
shorter length than `KnowledgeEntry.summary`'s 200 — a chat title, not a
note excerpt) in the same transaction as the insert.

### 2.3 Controller (`src/api/chatSessionsController.ts`) + routes (`src/core/server.ts`)

Same thin-handler shape as `knowledgeEntriesController.ts`. Route order has
no `:id`-vs-literal collision risk here (unlike `002-retrieval`'s `/search`)
since every literal segment (`/messages`) already sits after an `:id`
segment, not before another route.

```typescript
app.post('/chat-sessions', chatSessionsController.create);
app.get('/chat-sessions', chatSessionsController.list);
app.get('/chat-sessions/:id', chatSessionsController.getById);
app.post('/chat-sessions/:id/messages', chatSessionsController.appendMessage);
app.delete('/chat-sessions/:id', chatSessionsController.remove);
```

## 3. `orchestrator` — direct `KnowledgeStoreClient`

New file, `src/knowledge/knowledgeStoreClient.ts` (own top-level folder,
not `mcp/`, since this deliberately bypasses MCP — ADR-0002):

```typescript
export interface ChatSessionSummary { id: string; title: string | null; updatedAt: string; }
export interface ChatSessionDetail extends ChatSessionSummary {
  createdAt: string;
  messages: Array<{ id: string; role: 'USER' | 'ASSISTANT' | 'TOOL'; content: string; createdAt: string }>;
}

export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}
  createChatSession(): Promise<ChatSessionSummary & { createdAt: string }>;
  appendChatMessage(sessionId: string, role: 'USER' | 'ASSISTANT' | 'TOOL', content: string): Promise<void>;
}
```

Only the two methods `inquireController` actually needs this iteration
(create + append) — `list`/`getById`/`delete` are called by
`services/frontend` directly (ADR-0001's existing pattern, extended the
same way to this new resource), not by `orchestrator`.

### 3.1 `inquireController` change

```typescript
// request body gains: sessionId?: string
// after Orchestrator.processConversation resolves the assistant's reply:
const sessionId = req.body.sessionId ?? (await knowledgeStoreClient.createChatSession()).id;
try {
  await knowledgeStoreClient.appendChatMessage(sessionId, 'USER', latestUserMessage.content);
  await knowledgeStoreClient.appendChatMessage(sessionId, 'ASSISTANT', response.content ?? '');
} catch (error) {
  console.warn('⚠️ No se pudo persistir la sesión de chat:', error); // AC8 — never blocks the reply
}
// response body gains: sessionId
```

Kept in `inquireController`, not `Orchestrator.processConversation` itself
— `Orchestrator` stays about reasoning (and, from `001-reasoning-pipeline`
on, the LangGraph run), not HTTP request bookkeeping. This is also why
ADR-0002 calls session persistence "bookkeeping around `POST /api/inquire`
itself," not part of the reasoning graph.

## 4. Design patterns applied

- **Service Layer**: `ChatSessionService` holds the only titling/cascade
  logic — controller stays thin.
- **Dependency Injection**: `ChatSessionService` takes `prisma` and
  `userService` via constructor, same as `KnowledgeEntryService`; wired once
  in `index.ts`.
- No new pattern in `orchestrator` — `KnowledgeStoreClient` here is a plain
  thin HTTP wrapper, same shape as `mcp-server`'s client of the same name
  (different file, different service, ADR-0002 explains why there are now
  two clients with the same name in two different services).

## 5. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `ChatSessionService` (mocked `PrismaClient`, `UserService`) | AC1–AC5, especially: title only set on the first `USER` message, not subsequent ones; `updatedAt` bump on append |
| `chatSessionsController` (supertest) | 201/200/404 per endpoint, `DELETE` → `204` |
| `orchestrator`'s `KnowledgeStoreClient` (stubbed `fetch`) | request shape for both methods, error propagation |
| `inquireController` (mocked `KnowledgeStoreClient`, mocked `Orchestrator`) | AC7 (creates a session when none given, returns `sessionId`), AC8 (persistence failure doesn't change the response) |

## 6. Build order (→ `tasks.md`)

1. Prisma schema (§2 in spec) + migration.
2. `ChatSessionService` + tests.
3. Controller + routes + tests.
4. `orchestrator`'s `KnowledgeStoreClient` + tests.
5. `inquireController` wiring (`sessionId` in/out) + tests.
