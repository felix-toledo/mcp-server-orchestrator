# Spec — Chat

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-18 (see README), no longer blocked on Clause I |
| **Group** | frontend (also touches `services/orchestrator` — configuration only, no new endpoint) |
| **Depends on** | [`knowledge-store/001-vectorization`](../../knowledge-store/001-vectorization/spec.md) — soft dependency: chat works without it, it just can't save notes (AC4 below) |
| **Open Questions** | Resolved — see [`.specify/specs/README.md`](../../README.md#open-questions-blocking-all-4-specs-resolve-before-any-advances-to-plan) for the log |
| **Constitution clauses in play** | I, IV |

## 1. Goal

The user talks to ALMA in natural language and gets a reply, using DeepSeek
as the LLM, with ALMA able to save a note via the `createKnowledgeEntry`
tool mid-conversation.

## 2. User Story & Acceptance Criteria

As the user, I talk to ALMA in natural language and get a reply.

- **AC1**: Given the main view is open, when I send a message, the frontend
  calls `POST /api/inquire` on the orchestrator and renders ALMA's reply.
- **AC2**: Given `LLM_PROVIDER=deepseek` is configured, the orchestrator
  answers using DeepSeek — already supported by `LlmProviderFactory`, no
  code change needed there, only env vars (see §4).
- **AC3**: Given ALMA's reply involves creating a note, the LLM calls the
  `createKnowledgeEntry` tool (defined in
  [`knowledge-store/001-vectorization`](../../knowledge-store/001-vectorization/spec.md));
  on success, ALMA's visible reply confirms the note's title — existing
  tool-call-result-to-LLM loop in `Orchestrator.ts`, no change needed there.
- **AC4**: Given `knowledge-store` is unreachable when the tool is called,
  the existing per-tool-call try/catch in `Orchestrator.ts` turns the
  failure into a `tool` message with an `error` field fed back to the LLM,
  and ALMA's reply says it couldn't save the note — the request never fails
  with a 500. (Backend half of this behavior: `knowledge-store/001-vectorization`
  AC5.)
- **AC5**: Chat history is **not** persisted server-side across page
  reloads this iteration — the frontend holds the growing message array in
  its own state and resends it each turn, matching the orchestrator's
  existing stateless `processConversation`. See Out of Scope.

## 3. API Contract — unchanged, reused

`POST /api/inquire` keeps its existing `InquireRequestSchema` (see
`services/orchestrator/src/api/inquireController.ts`) — no request/response
shape change. What changes is configuration only (§4) and the default
`systemInstructions` constant in `Orchestrator.ts` (currently
`"Eres un asistente inteligente"`), which gets replaced with an
ALMA-identity prompt in Spanish that mentions the `createKnowledgeEntry`
tool and when to use it — exact wording is an implementation detail for
`plan.md`, not a business rule.

## 4. Environment variables

**`services/orchestrator/.env`** (already documented in `.env.template` —
just needs to actually be set):

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat
```

**`services/frontend/.env`** (new):

```env
PORT=30022
ORCHESTRATOR_URL=http://localhost:30021
KEY_ALLOWED_AGENTS=your-secret-key   # sent as the KAA header when calling /api/inquire server-side
```

## 5. Folder structure (new files under `services/frontend`)

```
services/frontend/src/
├── app/page.tsx                    # main view: chat panel + explorer (see frontend/003-explorer)
├── actions/
│   └── send-chat-message.ts        # Server Action: POST /api/inquire with the KAA header
├── components/chat/
│   ├── ChatPanel.tsx
│   └── MessageBubble.tsx
└── lib/
    └── orchestrator-client.ts      # framework-agnostic HTTP client, no next/react imports
```

## 6. Out of Scope — Future Work

- Chat history persistence across page reloads/sessions.
- Streaming responses (current `/api/inquire` is request/response JSON).
- Retrieval/RAG grounding answers in the vault's vectors (LOGOS's future
  job — see `docs/context.md`).
