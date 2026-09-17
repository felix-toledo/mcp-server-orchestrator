# `knowledge-store` is a separate service, not part of `mcp-server`

**Status**: accepted

`services/mcp-server` already has an (empty) `prisma/schema.prisma`, and the
repo's own convention says "one MCP server, one orchestrator — don't blur
the line," which would suggest putting ALMA's Postgres/pgvector access there.
We decided against that: a new service, `services/knowledge-store`, owns the
`User`/`KnowledgeEntry` tables (Prisma) **and** all filesystem I/O on the
vault (`%USERPROFILE%\Documents\alma\vault`), and is called over HTTP by `mcp-server`
(for the `createKnowledgeEntry` tool) and directly by `services/frontend`
(for browsing/editing the vault) — with `services/orchestrator` expected to
call it too once retrieval (RAG over the vault) is scoped in a future spec.

**Why**: the frontend's explorer/editor and the orchestrator's future
retrieval both need the same row+file data `mcp-server` would otherwise own
alone. Splitting file I/O and DB writes across three callers risks them
drifting out of sync (a note edited from the frontend without its embedding
refreshed, for instance); one service owning both halves keeps that sync
logic in exactly one place. The trade-off is one more moving part (an extra
HTTP hop, an extra service to run in dev) than keeping it inside
`mcp-server` — accepted because the alternative (frontend and orchestrator
each embedding their own DB/file-sync logic, or everything routed through
`mcp-server` as an ad hoc data-access proxy it was never meant to be) is
worse.

## Consequences

- `mcp-server`'s `prisma/schema.prisma` stays empty; the real schema lives in
  `services/knowledge-store/prisma/schema.prisma` instead.
- [`docs/conventions/frontend.md`](../conventions/frontend.md)'s "the
  frontend never calls `mcp-server` directly, and it never talks to
  Prisma/the database directly — all data access goes through the
  orchestrator" rule no longer holds as stated — the frontend may call
  `knowledge-store` directly for vault/onboarding operations. Chat still
  goes through `services/orchestrator`. That file's wording should be
  corrected the next time it's touched for another reason.
