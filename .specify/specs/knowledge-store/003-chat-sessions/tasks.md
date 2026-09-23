# Tasks — Chat session persistence

Base: [`plan.md`](./plan.md) §6. Vitest required in both `knowledge-store`
and `orchestrator`.

- [ ] **T1 — Prisma schema**: `ChatSession`, `ChatMessage`, `ChatMessageRole`
  (plan §2 in spec.md §5), migration run.
- [ ] **T2 — `ChatSessionService`**: `create`/`list`/`getById`/`appendMessage`
  (with auto-titling)/`delete`. Tests: AC1–AC5, titling-only-once case,
  `updatedAt` bump.
- [ ] **T3 — `knowledge-store` HTTP surface**: `chatSessionsController` +
  routes. Tests: one per endpoint/status code (mirrors
  `core/server.test.ts`'s existing style).
- [ ] **T4 — `orchestrator`'s `KnowledgeStoreClient`**: `createChatSession`,
  `appendChatMessage`. Tests: request shape, error propagation.
- [ ] **T5 — `inquireController` wiring**: `sessionId` request/response
  field, session creation when omitted, persistence failure doesn't block
  the reply (AC7, AC8). Tests for both.
- [ ] **T6 — Manual end-to-end check**: create a session via chat, send a
  second message with that `sessionId`, confirm both messages and the
  auto-generated title show up via `GET /chat-sessions/:id`; delete it,
  confirm `404` after.
