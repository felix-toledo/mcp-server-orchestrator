# Plan — Chat

Base: [`spec.md`](./spec.md). Assumes `frontend/001-onboarding`'s scaffold
and layering (plan §1–§2 there) already exist.

## 1. Contracts

```typescript
// src/lib/orchestrator-client.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
}

export class OrchestratorClient {
  constructor(private readonly baseUrl: string, private readonly kaaKey: string) {}
  inquire(messages: ChatMessage[]): Promise<ChatMessage>; // POST /api/inquire, KAA header, throws on non-2xx
}
```

```typescript
// src/actions/send-chat-message.ts
export async function sendChatMessage(history: ChatMessage[]): Promise<ChatMessage>;
// AC1/AC3: forwards to orchestratorClient.inquire(history)
// AC4: catches a thrown error, returns { role: 'assistant', content: '<no pudo procesar tu mensaje>' }
//      instead of letting the Server Action itself throw to the client
```

`ChatPanel.tsx` (Client Component — the one leaf that needs interactivity,
per `docs/conventions/frontend.md`) owns the growing `ChatMessage[]` in
`useState` (AC5 — no persistence) and calls `sendChatMessage` on submit.

## 2. Orchestrator-side change (not a new layer — one constant)

`services/orchestrator/src/mcp/Orchestrator.ts`'s `systemInstructions`
constant changes from `"Eres un asistente inteligente"` to an ALMA-identity
prompt in Spanish mentioning `createKnowledgeEntry` and when to use it
(exact wording: implementer's judgment, not a business rule — spec §3
already says so). `LLM_PROVIDER=deepseek` + `DEEPSEEK_API_KEY` set in
`services/orchestrator/.env` (spec §4) — no code change for that part,
`LlmProviderFactory` already supports it.

## 3. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `OrchestratorClient.inquire` (mocked `fetch`) | sends the `KAA` header; throws a recognizable error on non-2xx |
| `sendChatMessage` (mocked `OrchestratorClient`) | AC1/AC3 happy path; AC4 — a thrown error becomes a graceful assistant message, never an unhandled rejection |

No component-render test for `ChatPanel`/`MessageBubble` this iteration —
same reasoning as `frontend/001-onboarding` plan §5.

## 4. Build order → `tasks.md`

1. `lib/orchestrator-client.ts` + tests.
2. `actions/send-chat-message.ts` + tests.
3. `components/chat/ChatPanel.tsx` + `MessageBubble.tsx`.
4. Mount `ChatPanel` into `app/page.tsx` (alongside the explorer panel —
   `frontend/003-explorer` mounts the other half of the same page).
5. `Orchestrator.ts`'s `systemInstructions` + `services/orchestrator/.env`.
