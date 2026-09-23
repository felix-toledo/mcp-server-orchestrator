# `orchestrator` calls `knowledge-store` directly for chat session bookkeeping

**Status**: accepted

`CLAUDE.md`'s architecture rule says "orchestrator never touches
Prisma/the filesystem — only calls `mcp-server`'s tools." `002-retrieval`
kept that rule intact for vault search: `searchKnowledgeEntries` is a real
MCP tool, just one hidden from the LLM's own tool list. Chat session
persistence (`knowledge-store/003-chat-sessions`) is a different kind of
concern and doesn't fit that same shape.

**Why a new exception, not the same hidden-tool pattern `002-retrieval`
used**: retrieval is data the LLM's *reasoning* touches — grounding an
answer in the user's notes is conceptually "the assistant looked something
up," even if the user never sees the mechanics. Saving/loading which
messages belong to which chat session is not that — it's HTTP request
lifecycle bookkeeping around `POST /api/inquire` itself (which session is
this turn part of, append the user message, append the assistant's reply),
with no reasoning content and no reason to ever route through an MCP tool
call, hidden or not. Modeling it as an MCP tool would mean inventing 4-5
tools (`createChatSession`, `appendChatMessage`, `listChatSessions`,
`getChatSession`, `deleteChatSession`) whose only caller is `orchestrator`
itself on every single request — pure ceremony around what
`services/frontend` already does directly for onboarding and vault CRUD
(ADR-0001).

**Decision**: `services/orchestrator` may call `services/knowledge-store`'s
HTTP API directly for chat session/message bookkeeping — the same exception
ADR-0001 already carved out for `services/frontend`'s onboarding/vault
calls, extended to `orchestrator`. ADR-0001 itself anticipated this
("`services/orchestrator` expected to call it too once retrieval... is
scoped") — this ADR is that anticipation being exercised for a second,
distinct reason (sessions, not retrieval, which stayed on the MCP-tool
path).

**Alternatives considered**:

- Keep sessions behind hidden MCP tools, same shape as retrieval. Rejected:
  no reasoning content ever flows through them, so the MCP indirection buys
  nothing except an extra HTTP hop (`orchestrator` → `mcp-server` →
  `knowledge-store` instead of `orchestrator` → `knowledge-store`) and five
  more thin tool files to maintain in `mcp-server` for something that was
  never a capability an LLM should be aware of, even conceptually.
- Give `orchestrator` its own Prisma connection to the same database.
  Rejected for the same reason ADR-0001 rejected it for `mcp-server`:
  splits DB access across services, risking drift; `knowledge-store` stays
  the one place that owns the schema and the one place migrations run.

## Consequences

- `CLAUDE.md`'s architecture rule for `orchestrator` needs updating: "only
  calls `mcp-server`'s tools" becomes "calls `mcp-server`'s tools for
  anything LLM-reasoning-shaped (including hidden tools like retrieval);
  calls `knowledge-store` directly for chat session bookkeeping, mirroring
  `services/frontend`'s existing exception (ADR-0001)."
- `services/orchestrator` gains a `KnowledgeStoreClient`-shaped HTTP client
  of its own (or a shared one from `packages/shared`, decided in
  `knowledge-store/003-chat-sessions`'s plan) — separate from
  `services/mcp-server`'s existing client of the same name, since they're
  different services with different `KNOWLEDGE_STORE_URL` env vars already.
- The distinction this ADR draws (reasoning-relevant data → MCP tool,
  even hidden; pure request bookkeeping → direct HTTP, ADR-0001-style) is
  now the standing rule for any future case like this, not just sessions —
  worth citing by name instead of re-litigating next time it comes up.
