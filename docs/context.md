# Domain Context: ALMA

> **Status: active domain.** This file replaces the previous "Provincial
> Public Works System" domain glossary (superseded 2026-09-17 — see git
> history if that content is ever needed again). ALMA is Felix's final
> degree project (Ingeniería en Sistemas de Información): a personal,
> local-first knowledge assistant. You talk to it, it writes what it learns
> as Markdown notes on your own disk, and those notes get embedded so ALMA
> (and, later, you) can find them again. This is a living glossary of domain
> decisions, kept in sync by the `planner` agent — read it before asking a
> domain question that might already be answered here, and update it the
> moment a new one is resolved. Business rules never get invented; if it's
> not written here or in an active spec, it's an Open Question.

## `docs/context-extended.md` — confirmed authoritative (2026-09-18)

`docs/context-extended.md` is the PFG master document: two-person team
(Felix + Facundo Peloso, with Lic. Silvina Podestá as course instructor), a
4-table long-term data model, a SkillRouter+RAG+reranker reasoning engine,
CHRONOS (a scheduler module not previously mentioned in `brain_vault/`),
RAFT pilot, WhatsApp/Cloudflare infra. Felix confirmed it directly and
intentionally added it to the repo (2026-09-18) — it's tracked in git, not
gitignored. Two of its recommendations were explicitly **overridden** for
this PoC rather than adopted as-is — see "Origin and vision" below and
[Resolved decisions](#resolved-decisions) — everything else in it (the
long-term vision, the eventual 4-table model, the reasoning engine) is real
context for *where this PoC is headed*, not something this PoC implements
yet. Treat it the same way as `brain_vault/`: useful background, not a spec.

## Origin and vision (`brain_vault/memory/` + `docs/context-extended.md`)

Before this repo had any ALMA-specific spec, Felix sketched the intended
shape of ALMA as a set of "skills" in `brain_vault/memory/`, later expanded
into the full PFG master document at `docs/context-extended.md` (see above —
confirmed authoritative). Both describe the same four conceptual pillars —
worth reading once for context, not themselves a spec for this PoC:

- **Memory/materialization** (`brain_vault/` calls this MNEMOS) — ALMA
  writes its thoughts to Markdown files in a local vault (data sovereignty —
  nothing lives only in someone else's cloud), with YAML frontmatter and
  `[[WikiLinks]]` toward a future knowledge graph. **This iteration's
  `createKnowledgeEntry` MCP tool + `knowledge-store` service are this
  pillar's first real implementation** — see
  [`.specify/specs/knowledge-store/001-vectorization`](../.specify/specs/knowledge-store/001-vectorization/spec.md).
- **Reasoning/orchestration** (MNEMOS's counterpart there, LOGOS) — decides
  intent, and searches the vault's vectors before answering so personal
  context shapes the reply. A first, simple version (always-on top-5,
  similarity-threshold filtered) shipped in
  [`knowledge-store/002-retrieval`](../.specify/specs/knowledge-store/002-retrieval/spec.md).
  The full `context-extended.md` SkillRouter+RAG-top20+reranker+compressor
  design is now scoped in
  [`orchestrator/001-reasoning-pipeline`](../.specify/specs/orchestrator/001-reasoning-pipeline/spec.md),
  which supersedes `002-retrieval`'s simple threshold with the reranker as
  the new relevance filter — see that spec's §2 for exactly what carries
  over vs changes.
- **End-of-day consolidation** (ONIROS) — `context-extended.md` §5 now gives
  this pillar concrete, non-negotiable-once-built rules (never deletes
  long-term knowledge; an explicit "remember this" bypasses it entirely and
  goes straight to `KnowledgeEntry`; everything else gets curated at day's
  end by its own judgment; it also generates next-day insight summaries).
  **Out of scope this iteration** — no `Conocimientos diarios`/logs table
  exists yet (see the simplified-schema decision below).
- **Scheduling** (CHRONOS in `context-extended.md` — new, wasn't in
  `brain_vault/`) — a persistent queue for calendar/reminder/async actions
  (`pg-boss` was `brain_vault/`'s specific suggestion for the mechanism).
  Now scoped in [`scheduler/001-agendas`](../.specify/specs/scheduler/001-agendas/spec.md)
  (new `services/scheduler`) plus [`telegram-bot/001-channel`](../.specify/specs/telegram-bot/001-channel/spec.md)
  for actually delivering a fired reminder.

**How to apply — naming, confirmed 2026-09-18**: Felix explicitly doesn't
want the mythological names (LOGOS/MNEMOS/CHRONOS/ONIROS) used as real
module/service names in code, even though `context-extended.md` itself says
to keep them "tal cual" — that recommendation is **overridden** for this
codebase. Code uses plain descriptive names instead: `orchestrator`,
`knowledge-store`, `createKnowledgeEntry`, and (whenever a scheduler service
actually gets scoped) something like `scheduler` or `task-queue`, not
`chronos`. The mythological names stay fine to use in conversation/the PFG
report when talking about the four conceptual pillars above — just not in
`services/*` folder names, class names, or table names.

## Naming convention for this domain

Same reasoning as before, different audience: ALMA's only user (for this
iteration) is Felix himself, a Spanish speaker, and the onboarding copy he
already wrote is in Spanish.

- **Code, schema, docs, tool names → English.** Matches the repo-wide
  convention (see [`conventions/naming.md`](./conventions/naming.md)).
- **User-facing content → Spanish.** Onboarding copy, chat replies, and any
  system prompt text stay in Spanish. This is now ALMA's carve-out from the
  repo-wide English convention (the Public Works carve-out it replaces is
  gone along with that domain).

## Glossary

| Code term (English)     | What it is                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `User`                   | The single local person using this ALMA instance (see [Resolved decisions](#resolved-decisions) — not multi-tenant this iteration). |
| `Purpose`                | The onboarding answer to "what do you want ALMA for" — a fixed enum, see below.                          |
| `KnowledgeEntry`         | One row of metadata (path, title, summary, embedding) for a Markdown note living in the vault. The full content lives only in the `.md` file, never duplicated into the row. |
| `vault`                  | The folder of Markdown files ALMA reads/writes, `%USERPROFILE%\Documents\alma\vault` for this iteration (Windows-only, see Resolved decisions). |
| `knowledge-store`        | The new service owning Postgres/pgvector access **and** vault filesystem I/O — the single source of truth every other service goes through (see Resolved decisions). |
| `createKnowledgeEntry`   | The MCP tool the orchestrator calls to make ALMA write a new note.                                       |
| `searchKnowledgeEntries` | The MCP tool (hidden from the LLM, called automatically every turn) that runs the vault semantic search. |
| `ChatSession`            | One conversation thread as the user sees it in the UI — has a title, belongs to the one `User`, holds an ordered list of `ChatMessage`s. Persists indefinitely until the user deletes it. Shared across channels (web, Telegram) — see Resolved decisions. |
| `ChatMessage`            | One turn within a `ChatSession` — role (`user`/`assistant`/`tool`), content, timestamp. |
| `Agent`                  | A configurable preset: a system-prompt addendum (added on top of ALMA's base rules, never replacing them) plus which MCP tools and which skills it's allowed to use. Not a separate LLM or process — a config row the reasoning graph reads before running. |
| `Skill`                  | A capability description (a `.md` file today) the `SkillRouter` dynamically decides is relevant to a given message. Before the `SkillRouter` existed, skill selection required the caller to name skills explicitly in the request body — `services/frontend` never did, so in practice no skill was ever actually injected; the router is what makes automatic selection exist at all, not a replacement of an always-on default (correction, found 2026-09-17 while implementing `orchestrator/001-reasoning-pipeline`). |
| `SkillRouter`            | The small/fast-model graph node that decides, per message, which skill(s) apply and whether the task is complex enough to need a plan. |
| `reminder` / `agenda`    | A scheduled action (`scheduler`'s `pg-boss` job) created from natural language ("todos los días a las 15:30..."), one-off or recurring, that fires ALMA's action (deliver a message via Telegram, log it) at the scheduled time(s). |
| `ops-connector`          | A **planned, not yet built** MCP server (`services/ops-connector`, port 30027) for scoped execution against external systems Felix manages himself — local terminal commands, SSH to pre-registered remote hosts, and HTTP API/database access. See [`ops-connector/001-external-execution`](../.specify/specs/ops-connector/001-external-execution/spec.md) — deliberately left Draft/backlog: the allowlist policy, confirmation flow, and credential-storage decisions are all open, unlike every other MCP tool ALMA already has. |
| `voice-assistant`        | A **planned, not yet built** service (`services/voice-assistant`, port 30028) — this repo's first **Python** service, a background daemon on Felix's own PC providing wake-word voice activation. See [`voice-assistant/001-wake-word-channel`](../.specify/specs/voice-assistant/001-wake-word-channel/spec.md) — Draft, ready for Plan: 4 of 6 Open Questions resolved 2026-09-22 (wake-word phrase/model, confidence threshold/retry, process management, utterance-end detection), the remaining 2 (offline-model licensing, future Docker packaging) are non-blocking for local dev. See "Voice channel" below for the locked architecture forks. |
| wake word                | The fixed phrase the `voice-assistant` daemon continuously listens for on the local mic before it starts paying attention to anything else — same concept as "Hey Siri"/"Alexa." Resolved 2026-09-22: one of `openwakeword`'s existing pretrained models (e.g. "hey jarvis") as a functional placeholder, not a custom-trained "Hey ALMA" model — see `voice-assistant/001-wake-word-channel` §8. |
| speaker verification     | The step, immediately after wake-word detection, that checks the captured audio is actually **Felix's** voice (via `speechbrain`'s ECAPA-VoxCeleb model) before anything gets transcribed or forwarded — a stranger saying the wake word is silently ignored, same "don't reveal you're listening" posture `telegram-bot` already uses for an unbound `chat_id`. |
| `VoiceProfile`           | The `knowledge-store`-owned row (one per `User`) tracking whether Felix's voice is enrolled (`NOT_TRAINED`/`TRAINED`), plus a path to the raw enrollment audio sample on disk — `knowledge-store` stores the file, `voice-assistant` (not `knowledge-store`) runs `speechbrain` against it. See [`voice-assistant/001-wake-word-channel`](../.specify/specs/voice-assistant/001-wake-word-channel/spec.md) §5. |
| voice enrollment         | The one-time (or re-doable) act of recording a 10–15s voice sample, from Settings (`frontend/006-voice-enrollment`), that becomes the reference `VoiceProfile` speaker verification checks future utterances against. |

`Purpose` enum values (English name → the Spanish onboarding option it maps
to):

| Enum value                | Onboarding option (Spanish)                                    |
| -------------------------- | ---------------------------------------------------------------- |
| `PERSONAL_DAILY`            | día a día personal (recordatorios, notas, organización)         |
| `AUTOMATION_PRODUCTIVITY`   | automatizaciones y productividad                                 |
| `PROJECTS_WORK`             | proyectos y trabajo                                              |
| `SECOND_BRAIN_STUDY`        | segundo cerebro / estudio e investigación                        |
| `TEAM_BUSINESS`             | uso en equipo o empresa                                          |

## Resolved decisions

### Single local user, no authentication — this iteration

ALMA runs on Felix's own machine for one person. Confirmed 2026-09-17:

- Onboarding creates **at most one** `User` row. If a `User` already exists,
  the frontend skips onboarding and goes straight to the chat/explorer view.
- There is no login, no session token, no password. The `KAA` header
  (`validateAgentMiddleware`) keeps authenticating the *frontend as a
  calling channel* to the orchestrator, same as today — it has nothing to do
  with per-person identity, because there's only one person.
- Multi-user (separate vaults, real accounts) is explicitly a future
  concern, not scoped here — see the active spec's Out of Scope section.

**How to apply**: no tool or endpoint in this iteration needs a `userId`
parameter from its caller. `knowledge-store` resolves "the one user" itself.

### `knowledge-store` is the single source of truth for both DB and vault files — target architecture

Confirmed 2026-09-17: rather than mcp-server owning Prisma directly, ALMA
gets a **new, separate service** (`services/knowledge-store`) that owns:

- The Postgres/pgvector connection (Prisma) — `User` and `KnowledgeEntry`.
- All filesystem I/O on the vault (`%USERPROFILE%\Documents\alma\vault`) —
  reading, writing, and listing `.md` files.
- Embedding generation (calls an external embeddings API — see the active
  spec for the provider default) whenever a note is created or edited.

**Why**: Felix's own reasoning — the frontend (for the explorer/editor) and
the orchestrator (for future retrieval) will both need this data too, not
just mcp-server. A single service owning both halves (row + file) keeps them
from drifting out of sync, instead of duplicating that sync logic in every
caller.

**How to apply**: `services/mcp-server`'s `createKnowledgeEntry` tool is a
thin remote caller of `knowledge-store`'s HTTP API — it does not touch
Prisma or the filesystem itself. `services/frontend` calls `knowledge-store`
directly for vault browsing/editing (this supersedes the old "frontend only
talks to the orchestrator" rule, which was written for the Public Works
domain's LLM-mediated-everything model); `services/frontend` still talks to
`services/orchestrator` for chat. This is a deliberate, hard-to-reverse
architecture choice — see [`../adr/`](./adr/) once the ADR for it is written.

### Retrieval (RAG over the vault) and write-back to existing notes from chat — out of scope this iteration

- The orchestrator can make ALMA **create** a new note via
  `createKnowledgeEntry`. It cannot yet **search** the vault's vectors to
  ground an answer — that's LOGOS's future job (`retrieve_info` in
  `brain_vault/`), scoped in a later spec.
- Chat cannot edit an existing note. Editing is a frontend-only action (open
  a file in the explorer, change it, save) this iteration.

### Vault path — Windows-only, fixed location, this iteration

`%USERPROFILE%\Documents\alma\vault` is hardcoded for this iteration
(Felix's own machine) — confirmed 2026-09-18, changed from an earlier
`%APPDATA%\.alma\vault` default specifically because a `Documents`-visible
folder is easier to find, matching `context-extended.md`'s own reasoning for
recommending a home-visible location over an OS-standard one. `alma` (not
`.alma`) is the root folder name; `vault` is the one subfolder this PoC
needs — `context-extended.md`'s config/backups subfolders are deferred, not
decided against.

Cross-platform path resolution (macOS/Linux equivalents) is explicitly
deferred — see [`knowledge-store/001-vectorization`](../.specify/specs/knowledge-store/001-vectorization/spec.md)
for how this is isolated behind one function (`vaultRepository.ts`) so it's
a small change later, not a scattered one.

### Data model: 2-table PoC schema is deliberate, not accidental

`context-extended.md`'s eventual data model has 4 tables (`Usuario` with a
password hash, `Conocimientos`, `Logs de conversaciones`, `Conocimientos
diarios` for ONIROS's staging). This PoC intentionally implements only
`User` (no password — see the no-auth decision above) and `KnowledgeEntry`,
confirmed 2026-09-18: the goal right now is to prove the create → embed →
browse/edit loop works end to end, not to build the full long-term schema
ahead of the features that would use it. The other two tables
(conversation logs, daily staging) have no reason to exist before ONIROS or
conversation-history persistence are actually scoped — adding them now would
be exactly the kind of speculative, unused schema
[`docs/conventions/architecture.md`](./conventions/architecture.md#abstractions)
warns against.

**Update, 2026-09-17**: conversation-history persistence *is* now scoped
(`knowledge-store/003-chat-sessions`) — `ChatSession`/`ChatMessage` join the
schema. This is **not** the same table as `context-extended.md`'s "Logs de
conversaciones"/ONIROS staging concept — those stay deliberately unscoped
(no ONIROS nightly curation exists yet); `ChatSession`/`ChatMessage` is
simpler, user-facing conversation history only (what the sidebar shows, what
gets deleted when the user deletes a chat). `orchestrator/001-reasoning-pipeline`'s
compressor writes to an **in-request-only**, non-persisted summary — it does
not touch this table either. See each spec for the distinction spelled out
in full; don't conflate the three.

### Chat sessions are shared across channels — one memory, not one per channel

Confirmed 2026-09-17: a `ChatSession` is not tied to a channel (web,
Telegram). Either channel can continue any session — "hablale por Telegram,
seguí la charla en la web" is meant to feel like one continuous ALMA, not
two separate assistants that happen to share a vault. `telegram-bot/001-channel`
and `knowledge-store/003-chat-sessions` both implement this the same way:
there is no `channel` foreign key gating which messages a channel can see.

### Agents add to ALMA's base behavior, never replace it

Confirmed 2026-09-17: an `Agent`'s system-prompt addendum is appended to
`Orchestrator`'s base `systemInstructions` (the "don't narrate
saving/searching," "don't invent when there's no grounding" rules from
`knowledge-store/002-retrieval`), never substituted for them. No agent
configuration can silently disable ALMA's core voice/safety rules —
`orchestrator/002-multi-agent`'s spec encodes this as an Acceptance
Criterion, not just a convention.

### Multi-agent engine: LangGraph, not more hand-rolled `if`s

See [ADR-0003](./adr/0003-langgraph-for-reasoning-and-multi-agent.md) for
the full reasoning. Agent-to-agent invocation and "pipelines" (an agent
preconfigured to call others in sequence) are LangGraph subgraphs, not MCP
tools — a deliberate choice over the lower-risk alternative (model other
agents as hidden MCP tools, no new dependency) because
`docs/context-extended.md` names LangGraph specifically as ALMA's intended
engine for this, and because agent-to-agent call graphs (A calls B, B calls
A back, cycles) outgrow what a linear tool-call loop can express cleanly.

### Voice channel: local daemon, offline STT, local TTS playback, `knowledge-store`-owned enrollment — confirmed 2026-09-22

Four pivotal forks for the new `voice-assistant/001-wake-word-channel`
spec, resolved directly with Felix (`AskUserQuestion`) before that spec was
written — locked, not to be re-litigated in a future Clarify round for that
spec:

1. **Listener topology**: a local background Python daemon on Felix's own
   PC with direct mic access, not browser-captured/relayed audio. Matches
   every other "runs on Felix's own machine" default already in this file.
2. **STT**: local, offline (`faster-whisper` or equivalent) — no OpenAI
   Whisper API, no new external cost/dependency.
3. **TTS reply delivery**: synthesized locally (Kokoro TTS) and played
   through the same PC's speakers directly — not streamed to a browser.
4. **Voice enrollment profile storage**: `knowledge-store` owns it (same
   pattern as `TelegramLink`, per ADR-0001), not a bare file next to the
   Python process. `knowledge-store` stores the raw enrollment audio file
   (not a precomputed embedding — see `voice-assistant/001-wake-word-channel`
   §5.2 for why); `services/voice-assistant` reads it to run `speechbrain`.

**How to apply**: this is a third real channel (after `frontend` and
`telegram-bot`), forwarding transcribed text to `orchestrator`'s existing
`POST /api/inquire` with the same `KAA` header pattern — no new
webhook/auth shape gets invented for it.

**Second round, also confirmed 2026-09-22** (`AskUserQuestion`, closing 4 of
the spec's 6 Open Questions):

5. **Wake-word phrase/model**: one of `openwakeword`'s existing pretrained
   models (e.g. "hey jarvis") as a functional placeholder — not a
   custom-trained "Hey ALMA" model this round (needs synthetic data
   generation + training, deferred).
6. **Confidence threshold + retry**: single-attempt, no retry — wake-word
   score ≥0.5 triggers capture, speaker verification is one `speechbrain`
   `verify_batch` call at whatever default threshold
   `spkrec-ecapa-voxceleb` ships with. A failed match is silent; Felix just
   repeats the phrase.
7. **Process management/packaging**: PM2 for packaging/production (an
   `ecosystem.config.js`), reconciled explicitly with local dev — `pnpm run
   dev:voice-assistant`/`pnpm run dev:all` still bring the daemon up
   directly (no PM2 in that loop) so one command still starts every
   service, same as today.
8. **Utterance-end detection**: a fixed-duration recording window (e.g. 5
   seconds) after the wake word fires — VAD-based silence detection is
   deferred future work.

The remaining 2 Open Questions (offline-model licensing, future
Docker/`/dev/snd` device-mapping packaging) stay open but are explicitly
non-blocking for local dev — Felix wants this running on his own machine
today, and neither answer changes that. See
`voice-assistant/001-wake-word-channel` §8 for the full writeup.

### `orchestrator` calls `knowledge-store` directly for session bookkeeping

See [ADR-0002](./adr/0002-orchestrator-calls-knowledge-store-directly-for-sessions.md).
Session/message CRUD around `POST /api/inquire` is not something the LLM
ever reasons about, so it doesn't go through an MCP tool (hidden or not) —
`services/orchestrator` calls `services/knowledge-store`'s HTTP API
directly, the same exception ADR-0001 already gave `services/frontend`.
