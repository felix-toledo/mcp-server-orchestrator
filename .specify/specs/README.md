# ALMA — Knowledge PoC (spec index)

This PoC (onboarding → chat → note-via-MCP-tool → vectorize → browse/edit)
is split into **4 feature specs**, not one monolithic spec, so each has its
own focused User Stories/Acceptance Criteria and can be planned/implemented/
verified independently once its dependencies exist:

| # | Spec | Group | Depends on |
|---|---|---|---|
| 1 | [`knowledge-store/001-vectorization`](./knowledge-store/001-vectorization/spec.md) | backend | — (foundational) |
| 2 | [`frontend/001-onboarding`](./frontend/001-onboarding/spec.md) | frontend | #1 |
| 3 | [`frontend/002-chat`](./frontend/002-chat/spec.md) | frontend | #1 (soft — chat works without it, just can't save notes) |
| 4 | [`frontend/003-explorer`](./frontend/003-explorer/spec.md) | frontend | #1 |
| 5 | [`knowledge-store/002-retrieval`](./knowledge-store/002-retrieval/spec.md) | backend | #1 (needs `KnowledgeEntry.embedding` populated) |

Spec #5 was added 2026-09-17, after this PoC's first end-to-end pass was
live: chat could save notes but never read them back (confirmed live —
asked "qué conocimientos tenés de mí" right after saving one, got "no tengo
ningún conocimiento previo"). `001-vectorization` §8 had already flagged
Retrieval/RAG as deliberate future work; #5 is that work, scoped down from
`docs/context-extended.md`'s full vision (no SkillRouter/reranker/RAFT yet)
to what the current architecture supports today.

**Why this grouping**: `knowledge-store/001-vectorization` is one coherent
capability ("ALMA can turn a piece of text into a persisted, embedded note")
that happens to touch two services (`mcp-server`'s thin tool + the new
`knowledge-store` service, which owns the real logic) — splitting *that* in
two would just create busywork cross-referencing two specs for one feature.
Onboarding/chat/explorer, on the other hand, are three genuinely independent
user-facing capabilities that all happen to live in `services/frontend` —
each gets its own spec, grouped under `frontend/` for discoverability.

(Empty `mcp-server/`/`orquestador/` folders briefly existed here mid-session
and are gone again — likely an editor artifact, not a deliberate structure.
If you did mean to seed those as real spec groups, recreate them and this
index can point at them; for now nothing in this PoC needs a spec that
wouldn't fit under `knowledge-store/` or `frontend/`. Note: elsewhere this
repo uses `orchestrator` — English, matching `services/orchestrator` and
`docs/conventions/naming.md` — not `orquestador`.)

## Architecture (shared across all 4 specs)

```
┌────────────┐   POST /api/inquire        ┌──────────────┐   MCP (stdio/HTTP)   ┌─────────────┐
│  frontend  │ ─────────────────────────▶ │ orchestrator │ ───────────────────▶ │  mcp-server │
│  (30022)   │                            │   (30021)    │                      │   (30020)   │
└─────┬──────┘                            └──────────────┘                      └──────┬──────┘
      │                                                                                  │
      │  onboarding + vault CRUD (server-side only)                          createKnowledgeEntry
      │  HTTP                                                                            │ HTTP
      ▼                                                                                  ▼
                        ┌───────────────────────────────────────────────┐
                        │           knowledge-store (30025)                │
                        │  Prisma → Postgres + pgvector (User,             │
                        │  KnowledgeEntry)                                 │
                        │  fs I/O → Documents\alma\vault\*.md              │
                        │  embeddings provider (OpenAI)                    │
                        └───────────────────────────────────────────────┘
```

- `frontend` never touches Prisma or the filesystem itself — vault/onboarding
  operations go through `knowledge-store`'s HTTP API (spec #1), chat goes
  through `orchestrator`'s `/api/inquire`. See
  [ADR-0001](../../docs/adr/0001-knowledge-store-as-separate-service.md) for
  why `knowledge-store` is a separate service and why this is a deliberate
  exception to the old "frontend always through the orchestrator" rule.
- `orchestrator` never touches Prisma/the filesystem — only calls
  `mcp-server`'s tools.
- Full domain glossary and resolved decisions: [`docs/context.md`](../../docs/context.md).

## Open Questions — resolved 2026-09-18

All 5 raised from `docs/context-extended.md` (surfaced 2026-09-17, confirmed
authoritative and intentionally added to the repo by Felix on 2026-09-18)
are now closed. Keeping the log here, since every spec still links to this
section by number instead of repeating the reasoning.

- **OQ1 — Is `docs/context-extended.md` authoritative?** → **Yes.** Felix
  added it on purpose; it's tracked in git, not gitignored.
- **OQ2 — Service naming: `knowledge-store` vs. `mnemos`.** →
  **`knowledge-store` stays.** Felix explicitly does not want the
  mythological names (LOGOS/MNEMOS/CHRONOS/ONIROS) used as real
  service/module/class names in code, overriding `context-extended.md`'s
  "names stay as-is" line — plain descriptive names instead
  (`orchestrator`, `knowledge-store`, and eventually something like
  `scheduler`/`task-queue`, not `chronos`). See `docs/context.md`'s Origin
  and vision section. No rename needed anywhere in these specs.
- **OQ3 — Vault location.** → **`%USERPROFILE%\Documents\alma\vault`**
  (changed from the original `%APPDATA%\.alma\vault` — a `Documents`-visible
  folder is easier to find, matching `context-extended.md`'s own reasoning
  for a home-visible location). Updated throughout spec #1 and
  `docs/context.md`.
- **OQ4 — Attribution.** → Informational, resolved: this is Felix's and
  Facundo Peloso's shared PIF, Lic. Silvina Podestá as course instructor.
  No document needed a change beyond what `docs/context.md` already notes.
- **OQ5 — Should `docs/context-extended.md` be committed?** → **Yes**,
  tracked as-is.

None of the 4 specs have an unresolved Open Question left (Clause I is
satisfied). They're still marked "Draft" pending Felix's explicit go-ahead
to move to `Plan` — see each spec's Status row.
