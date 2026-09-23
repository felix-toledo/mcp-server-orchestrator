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
| 6 | [`knowledge-store/003-chat-sessions`](./knowledge-store/003-chat-sessions/spec.md) | backend | — (foundational for #7–#11) |
| 7 | [`frontend/004-chat-shell`](./frontend/004-chat-shell/spec.md) | frontend | #6, #4 (relocates the explorer), #9, #10, #11 (tabs) |
| 8 | [`orchestrator/001-reasoning-pipeline`](./orchestrator/001-reasoning-pipeline/spec.md) | backend | #5 (extends/supersedes its threshold), [ADR-0003](../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md) |
| 9 | [`orchestrator/002-multi-agent`](./orchestrator/002-multi-agent/spec.md) | backend | #8 (agents are nodes inside that same graph) |
| 10 | [`scheduler/001-agendas`](./scheduler/001-agendas/spec.md) | backend | — (parallel to #6–#9) |
| 11 | [`telegram-bot/001-channel`](./telegram-bot/001-channel/spec.md) | backend | #6 (shared sessions), depended on by #10 (delivery) |
| 12 | [`knowledge-store/004-vault-folders-and-llm-summaries`](./knowledge-store/004-vault-folders-and-llm-summaries/spec.md) | backend | #1 (amends its AC4 + folder scope) |
| 13 | [`frontend/005-vault-editor`](./frontend/005-vault-editor/spec.md) | frontend | #12, #4 (amends its editor/scope) |
| 14 | [`knowledge-store/005-skills`](./knowledge-store/005-skills/spec.md) | backend | — (parallel; `orchestrator` reads from it) |
| 15 | [`orchestrator/003-teams`](./orchestrator/003-teams/spec.md) | backend | #9 (reuses `AgentRegistry`), #14 (a team's own skills), #12 (projects are `VaultFolder`s) |
| 16 | [`ops-connector/001-external-execution`](./ops-connector/001-external-execution/spec.md) | backend (new `services/ops-connector`, port 30027, `planned`) | — (registers as an additional MCP server in `orchestrator`'s existing multi-server support) |
| 17 | [`desktop/001-installer`](./desktop/001-installer/spec.md) | infra/packaging | #2 (onboarding wizard pattern), #8 (`LlmProviderFactory` Strategy), #11 (Telegram channel toggle) |
| 18 | [`voice-assistant/001-wake-word-channel`](./voice-assistant/001-wake-word-channel/spec.md) | backend (new `services/voice-assistant`, port 30028, `planned`, first **Python** service) | #6 (shared sessions, as a Default not yet confirmed), #8 (`/api/inquire`, no change needed there) |
| 19 | [`frontend/006-voice-enrollment`](./frontend/006-voice-enrollment/spec.md) | frontend | #18 (`VoiceProfile` endpoints it calls), #7 (amends its Settings tab) |

Specs #14–#15 were added 2026-09-17, after Felix asked for a way to
configure teams of agents working toward a shared goal — grouped agents
with scoped delegation visibility, their own working folder(s) and
"proyectos" (existing `VaultFolder`s, not a new entity), and reusable
Skills as a real managed entity instead of `.md` files only `orchestrator`
could see. Both are implemented and verified live — see each spec's own
`tasks.md`.

Specs #6–#11 were added 2026-09-17, in one round, after Felix asked for a
much bigger next slice: splitting the frontend into a sessioned chat +
tabbed shell, real cron-backed reminders delivered over Telegram, and a
full rewrite of the reasoning loop (RAG top-20 + SkillRouter + reranker +
complexity branch + compressor + real multi-agent) on LangGraph — see
[ADR-0002](../docs/adr/0002-orchestrator-calls-knowledge-store-directly-for-sessions.md)
and [ADR-0003](../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md)
for the two architectural pivots this round required. **Build order
matters here more than in the first round** — #6 is the one true
foundation (both the frontend shell and the pipeline's session-adjacent
pieces need it to exist first), #8 must land before #9, and #10/#11 are
mutually dependent only at the delivery step (#10 can be built and tested
with a stubbed Telegram client before #11 is real).

Spec #17 was added 2026-09-18, after Felix asked to explore packaging ALMA
as a one-click Windows desktop installer ("cualquier persona pueda
utilizarlo"). Unlike every other spec here, it's **deliberately left in
Draft with unresolved Open Questions** (Constitution Clause I) — it names
real architecture decisions (embed Postgres+pgvector vs. migrate to an
embedded/file-based vector store; how far "bundle a local LLM" goes) that
haven't been decided yet, rather than guessing at them. It does not advance
to Plan until those are answered.

Specs #18–#19 were added 2026-09-22, after Felix asked for wake-word voice
activation: a background daemon that listens for a wake word, verifies it's
actually his voice (`speechbrain`'s ECAPA-VoxCeleb speaker verification, not
just anyone saying the phrase), transcribes the follow-up utterance locally
(offline STT), forwards it to `orchestrator`'s existing `POST /api/inquire`
exactly like any other channel, and speaks the reply back through local
speakers via Kokoro TTS. Four pivotal architecture forks (local Python
daemon topology, offline STT, local TTS playback instead of browser
streaming, `knowledge-store`-owned enrollment profile storage) were resolved
directly with Felix before either spec was written and are locked — see
`voice-assistant/001-wake-word-channel` §2. #18 is `services/voice-assistant`
itself, this repo's **first Python service** (port 30028, `planned`) — a
**second** `AskUserQuestion` round on 2026-09-22 closed 4 more of its
original 6 Open Questions (wake-word phrase/model, confidence
threshold/retry, process management/packaging, utterance-end detection);
the remaining 2 (offline-model licensing, future Docker/device-mapping) are
explicitly non-blocking for local dev, so the spec is now **ready for
Plan**, unlike #17. #19 is the
Settings-tab voice-enrollment screen (`frontend/006-voice-enrollment`,
amending #7's Settings tab the same way the Telegram token field did) — it
has **no Open Questions of its own** and can move to Plan independently,
since browser recording/upload/status display don't depend on any of #18's
still-open questions.

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
- `orchestrator` calls `mcp-server`'s tools for anything LLM-reasoning-shaped
  (including hidden tools like retrieval) **and**, as of specs #6–#11, calls
  `knowledge-store` directly for chat-session bookkeeping — see
  [ADR-0002](../../docs/adr/0002-orchestrator-calls-knowledge-store-directly-for-sessions.md).
- Specs #6–#11 add three more boxes to this diagram: `services/scheduler`
  (30026, `pg-boss`-backed reminders) and `services/telegram-bot` (30023,
  a second chat channel, shares `knowledge-store`'s `ChatSession`s with
  `frontend`) sit alongside the four above; `orchestrator` internally grows
  a LangGraph pipeline (spec #8) instead of the flat loop this diagram's
  arrows still describe correctly at the service-boundary level — see each
  spec's own plan.md for what changes inside `orchestrator`'s box.
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

None of specs #1–#15 have an unresolved Open Question left (Clause I is
satisfied for all of them). **Status as of 2026-09-17**: all of specs
#1–#15 are implemented and verified live (not Draft) — each spec's own
`tasks.md` has the task-by-task writeup, including every real bug found
along the way. `services/scheduler` and `services/telegram-bot` (specs
#10/#11) both exist and run; `telegram-bot` was verified against a real
`@BotFather` bot with real message delivery both ways.

**Spec #16 is the exception**, added 2026-09-18: prepared at Felix's
request as a captured-but-not-yet-clarified backlog item, inspired by how
other agent frameworks connect to local terminals/SSH/APIs — a new
`services/ops-connector` exposing scoped MCP tools for local command
execution, SSH to configured remote hosts, and HTTP API/DB access. It is
**deliberately left in Draft/backlog status** with 10 unresolved Open
Questions (allowlist policy, confirmation flow, SSH credential storage,
which agents/channels can reach it, and more — see its own §8) — this is a
materially bigger blast radius than anything else ALMA has shipped
(command/code execution vs. ALMA's own vault/reminders), so per Clause I
none of those questions get guessed. It does not advance to Plan until a
future `grill-with-docs` round with Felix closes them.
