# Tasks — Chat

Base: [`plan.md`](./plan.md) §4. Assumes `frontend/001-onboarding` T1
(scaffold) is done.

- [x] **T1 — `lib/orchestrator-client.ts`**: done, 2 tests passing.
- [x] **T2 — `actions/send-chat-message.ts`**: done, 2 tests passing.
- [x] **T3 — `ChatPanel.tsx` + `MessageBubble.tsx`**: done.
- [x] **T4 — Mounted into `app/page.tsx`**: done, alongside `ExplorerPanel`.
- [x] **T5 — Orchestrator system prompt + env**: `systemInstructions`
  rewritten (Spanish, ALMA identity, explains when to call
  `createKnowledgeEntry`). `services/orchestrator/.env` got commented
  `LLM_PROVIDER=deepseek`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` lines —
  **left commented, `LLM_PROVIDER` still defaults to `openai`**, since no
  real DeepSeek key was available to switch to it without breaking the
  service. Felix: uncomment + fill in `DEEPSEEK_API_KEY` when ready, per
  the original request's "I'll pass my API key via env var" plan.

**Verified**: `pnpm run build`/`lint`/`test` pass. Chat itself not yet
exercised against a live orchestrator+DeepSeek — needs T5's key filled in,
plus `knowledge-store`'s live DB for the `createKnowledgeEntry` half.
