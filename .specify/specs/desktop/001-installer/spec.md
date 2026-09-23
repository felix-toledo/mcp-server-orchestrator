# Spec — Desktop installer

| | |
|---|---|
| **Status** | Draft — Open Questions **not** resolved yet (see §9). Does not advance to Plan until they are (Constitution Clause I). |
| **Group** | infra/packaging (new, no existing `services/*` owns this — see §3) |
| **Depends on** | [`frontend/001-onboarding`](../../frontend/001-onboarding/spec.md) (wizard pattern to extend), [`orchestrator/001-reasoning-pipeline`](../../orchestrator/001-reasoning-pipeline/spec.md) §6.2/§7.3 (`ILlmProvider`/`LlmProviderFactory` — the Strategy this spec adds an `ollama` case to), [`telegram-bot/001-channel`](../../telegram-bot/001-channel/spec.md) (channel this spec's wizard must decide to enable or skip), [`docs/context-extended.md`](../../../../docs/context-extended.md) §8 (the project's original installer vision — see §2 for how this spec relates to it) |
| **Depended on by** | — (nothing yet; this is the top of the current roadmap) |
| **Constitution clauses in play** | I (this spec is deliberately left blocked at Clarify — see §9), III (Vitest, scoped per §7.2), IV, V (dormant) |

## 1. Goal

Package ALMA's six services (`mcp-server`, `orchestrator`, `knowledge-store`,
`scheduler`, `telegram-bot`, `frontend`) plus their data layer into a single
Windows installer that a non-technical person can run start-to-finish —
double-click, click through a few screens, end up with a running desktop app —
without installing Node, pnpm, Postgres, Docker, or editing a `.env` file by
hand. This spec exists to make that scope concrete enough to plan, and to
name, explicitly, the architecture decisions it depends on that nobody has
decided yet (§9) — per Constitution Clause I, this spec stays in **Draft**
until those are answered; it is not to be Planned or Implemented against as
written.

## 2. Relationship to `docs/context-extended.md` §8

The project's own vision doc already describes an installer:

> **Instalador:** todo lo anterior empaquetado en un instalador único (Docker
> Compose u homólogo), de forma que cualquier usuario —técnico o no— pueda
> levantar su instancia con fricción mínima. La base de datos se crea desde
> cero en el momento de la instalación.

That line is authoritative (confirmed in `.specify/specs/README.md`'s OQ1).
It names **Docker Compose "u homólogo"** — it does not mandate Docker
specifically, but it also does not anticipate the alternative raised in the
chat that produced this spec: an Electron desktop shell with an **embedded**
data layer and no Docker dependency at all. **This spec does not silently
pick between these two readings** — that tension is OQ1 in §9. Whoever
resolves it should treat "Docker Compose u homólogo" as the floor this spec
must at least match on friction, not as a reason to skip evaluating the
no-Docker alternative discussed in chat (AnythingLLM's approach — a bundled
embedded vector store instead of a bundled Postgres server).

## 3. Why this doesn't belong under an existing `services/*` group

Every other spec in this repo is grouped under the service it changes. This
one is different: it doesn't add a `services/*` workspace in the normal
sense (it's not another Express server on the next free port) — it adds a
**packaging/orchestration shell** that wraps all six existing services'
*built* output. If, during Plan, this becomes a real `services/desktop`
Electron app, `docs/ports.md` may or may not need a new row — the shell
itself doesn't need to serve HTTP to anything external, it only needs to
launch/health-check/tear down the six existing services on their existing
ports (`docs/ports.md`, unchanged). Confirm this at Plan time rather than
reserving a port speculatively now.

## 4. User Story & Acceptance Criteria

**As a person who is not Felix and has never touched a terminal**, I download
one file, run it, answer a few plain-language questions, and end up with
ALMA open and usable on my own PC — my notes live on my own disk, and I never
see a command prompt, an `.env` file, or an error about a missing dependency.

- **AC1**: A single distributable artifact (`ALMA-Setup-<version>.exe` or
  equivalent) contains everything needed to run all six services — no
  separate download/install step for Node, pnpm, Postgres, or Docker is
  presented to the user as a manual instruction (**how** that's achieved is
  OQ1/OQ2, §9 — this AC constrains the experience, not the mechanism).
- **AC2**: First launch runs a **setup wizard** (extends the pattern already
  established by `frontend/001-onboarding`, not a second, inconsistent UI)
  that, in plain language, asks only what a non-technical user can actually
  answer:
  - Where to keep the vault (default pre-filled, matching
    `docs/context.md`'s existing `%USERPROFILE%\Documents\alma\vault`
    convention — the user isn't asked to understand *why* this path,
    just confirm or change it).
  - Which LLM to use: a **bundled local model** (no account, works offline
    after first setup) or **their own API key** for a cloud provider — see
    §6 for how this maps onto the existing `LlmProviderFactory` Strategy.
  - Whether to enable the Telegram channel now or skip it (skipping must be
    a real, supported first-class path — seeing a bot-token field is not an
    acceptable default for someone who doesn't know what a Telegram bot is;
    see OQ5, §9, for how far "skippable" goes).
- **AC3**: After the wizard, all six services start automatically, in the
  dependency order `CLAUDE.md` already documents (`knowledge-store` and
  `mcp-server` first, health-checked, then the rest) — same shape as
  `scripts/dev-all.mjs`, but driving the *built* (`dist/`) output, not `dev`
  processes, and driven from the installed app's main process instead of a
  developer's terminal.
- **AC4**: Closing the app's window stops every service it started —
  including the tree-kill behavior `CLAUDE.md` already documents for
  `scripts/dev-all.mjs` on Windows (`taskkill /t /f`, since a plain
  `child.kill()` orphans `pnpm`/`next`'s own spawned children) — no orphaned
  Node/Postgres process left running after the window closes, and no
  leftover process holding a port open on the next launch.
- **AC5**: Any startup failure (a port already in use, a missing dependency,
  a failed migration) surfaces as a **plain-language message in the app's
  UI**, not a stack trace in a terminal the user doesn't have open. The user
  is never expected to read a log file to understand why ALMA didn't start.
- **AC6**: The data layer (whatever OQ1 resolves to, §9) is created from
  scratch on first run with no manual step — matching
  `docs/context-extended.md` §8's "la base de datos se crea desde cero en el
  momento de la instalación" — including running Prisma's migrations
  automatically (today's `pnpm run prisma:migrate` is a developer command;
  this AC requires the equivalent to run unattended, on first launch, inside
  the packaged app).
- **AC7**: Uninstalling the app removes the installed program files. The
  user's vault (Markdown notes on disk) and their database/data directory
  are **not** deleted by uninstall — same "your notes are yours, on your own
  disk" principle the project is already built on — unless the user
  explicitly opts into a full wipe.

## 5. Architecture decision A — the data layer (OQ1, unresolved)

`knowledge-store` today owns Postgres + pgvector via Prisma (ADR-0001). Two
real options exist for making that installable by "anyone," and this spec
does **not** pick one (see §9, OQ1):

- **A. Embed a real Postgres server + pgvector**, via a package like
  `pg0` or `@boomship/postgres-vector-embedded` (no Docker, no separate
  install, but these are young/niche packages with real packaging risk —
  a native binary per OS/arch, on top of Prisma's own native query-engine
  binary that already has to be handled carefully when bundled — see §7.1).
  `knowledge-store`'s schema, `KnowledgeEntryService`, and `vaultRepository`
  stay as they are.
- **B. Swap the vector store for something embedded/file-based** (e.g.
  LanceDB, or SQLite + `sqlite-vec`) — the approach a comparable real
  product (AnythingLLM) ships with. Removes the "bundle a database server"
  problem entirely, at the cost of a real migration of
  `KnowledgeEntryService`'s embedding read/write path (today's
  `$executeRaw`/`$queryRaw` `Unsupported("vector(1536)")` handling,
  documented in `CLAUDE.md`'s `knowledge-store` section, would no longer
  apply) and of the relational tables (`Agent`, `ChatSession`, `Skill`,
  `Team`, `TelegramLink`, ...) that would need a plan for where they live if
  Postgres goes away entirely (most likely: SQLite for relational data,
  paired with the embedded vector store for embeddings — not decided here).

This is the single decision every other part of this spec's Plan depends on
— it determines what `extraResources`/`asarUnpack` packaging (§7.1) actually
has to contain, and it is not a packaging detail, it is a `knowledge-store`
architecture change if Option B is chosen. It must be resolved (Clarify,
likely with `grill-with-docs` given it touches an ALMA domain decision not
yet in `docs/context.md`) before this spec can move to Plan.

## 6. Architecture decision B — local LLM by default, own key as the alternative

Both options discussed in chat are in scope, matching what the user
confirmed:

- **Default: a bundled local model**, using [`electron-ollama`](https://github.com/antarasi/electron-ollama)
  or equivalent to install/manage Ollama without the user running a
  separate installer, and a small default model chosen for modest hardware
  (a specific model is **not** pinned here — see OQ3, §9).
- **Alternative: the user's own API key** for a cloud provider, offered in
  the wizard (AC2) and in Settings afterward — this maps onto adding an
  `ollama` case to the **existing** `ILlmProvider`/`LlmProviderFactory`
  Strategy (`orchestrator/001-reasoning-pipeline` §6.2/§7.3), the same
  pattern `LLM_PROVIDER=openai|gemini|deepseek|copilot` already uses today.
  No new pattern — this is that Strategy's fifth implementation.

`orchestrator/001-reasoning-pipeline`'s own OQ1 explicitly deferred a local
(Ollama) option as future work ("keeps this round's infra footprint down").
This spec is that future work — noted here so Plan doesn't need to
re-discover that cross-reference.

## 7. Packaging shape (informational — not an AC until Plan)

- **Shell**: Electron. Main process ports the startup/health-check/teardown
  logic `scripts/dev-all.mjs` already implements, but against each
  service's `dist/` build output instead of `pnpm run dev:*`.
- **Builder**: `electron-builder`, NSIS target for Windows first (§9 OQ4 —
  whether macOS/Linux are in scope at all).
- **7.1 — Native binaries are the main packaging risk**, independent of how
  OQ1 resolves: Prisma's query engine is a native binary that has to be
  correctly declared in `extraResources`/`asarUnpack` or the packaged app
  silently can't find it — a known class of failure in Electron + Prisma
  setups, and this repo has *already* hit two variants of "two things that
  generate a native/Prisma artifact collide" (the pnpm virtual-store
  collision documented in `CLAUDE.md` for both `mcp-server`'s removed
  `prisma/` folder and `scheduler`'s custom Prisma `output` path). Whatever
  OQ1 picks, budget real verification time for this, not just a
  config-and-done assumption.
- **7.2 — Testing scope**: the six services' own Vitest suites are
  unaffected by this spec. The **new** logic this spec introduces (the
  Electron main process's startup/health-check/teardown orchestration, and
  the wizard's config-writing) should get its own coverage — the exact
  shape (Vitest against the main-process module, since a real installer
  end-to-end test isn't practical in CI) is a Plan-time decision, not
  specced here.
- **7.3 — Onboarding wizard** extends `frontend/001-onboarding`'s existing
  screens/pattern rather than building a second, parallel onboarding UI —
  the new questions (§4 AC2) are additions to that flow, not a competing one.

## 8. Defaults & Assumptions (mark any correction inline)

1. **Windows-first.** The user's own dev machine and everything discussed
   in chat is Windows; macOS/Linux installers are not assumed in scope
   unless OQ4 (§9) says otherwise.
2. **Single-user, no accounts** — same trust model the rest of ALMA already
   uses (Constitution Clause V, dormant). The installer does not introduce
   multi-user provisioning.
3. **Vault location stays user-editable** in the wizard, defaulting to the
   existing `%USERPROFILE%\Documents\alma\vault` convention — not a new
   decision, just carried over.
4. **Code signing is assumed out of scope** for this round (§10) — an
   unsigned `.exe` will show Windows SmartScreen's "unknown publisher"
   warning. This is a real friction point against "anyone can use it," not
   a cosmetic detail, and it's flagged rather than silently absorbed — see
   OQ6, §9.

## 9. Open Questions — **unresolved, blocking Plan** (Constitution Clause I)

This spec is intentionally left in this state. Do not answer these by
picking whatever seems reasonable and writing the code — resolve them with
Felix first (`grill-with-docs` is the right tool for OQ1 and OQ3, which are
real ALMA domain decisions, not just technical ones).

- **OQ1 — Data layer (§5)**: embed a real Postgres+pgvector server (Option
  A), or migrate `knowledge-store` to an embedded/file-based vector store
  (Option B)? This also decides whether `docs/context-extended.md` §8's
  "Docker Compose u homólogo" phrasing is satisfied by a no-Docker Electron
  build, or whether Docker Compose should remain the actual transport for
  Postgres specifically inside the installer.
- **OQ2 — Does the installer bundle Docker Desktop as a dependency at all**,
  as a fallback if OQ1 picks Option A and the embedded-Postgres packages
  turn out not to be production-solid? (Docker Desktop has its own install
  friction and licensing terms for some organizational use — not a given
  for a "cualquier persona" target.)
- **OQ3 — Which default local model ships with the bundled Ollama setup**,
  and is it downloaded during install (bigger installer, fully offline
  after) or on first run (smaller installer, needs internet once)? Depends
  on a real hardware-floor decision ("what's the worst laptop this should
  still work on") that hasn't been made.
- **OQ4 — Is macOS/Linux in scope for this round**, or is a Windows-only
  installer an acceptable answer to "cualquier persona" for this project's
  purposes (a final-degree-project defense, not a commercial release)?
- **OQ5 — How optional is the Telegram channel really?** Skippable in the
  wizard per AC2, but does "skip" mean the service doesn't start at all, or
  starts idle (matching `telegram-bot/001-channel` AC1's existing "no token
  configured → runs but does nothing" behavior)? Affects AC3's startup
  sequencing.
- **OQ6 — Is an unsigned installer (§8.4) acceptable**, or does "cualquier
  persona pueda usarlo" require solving code signing (cost/certificate)
  this round? Un-decided; flagged, not assumed either way.

## 10. Out of Scope — Future Work

- Auto-update mechanism (`electron-builder`'s `autoUpdater`) — this round
  ships a version people install once, not a self-updating app.
- Code signing (see OQ6 — flagged as a question, not pre-committed to
  "future work," but if OQ6's answer is "not this round," it lands here).
- macOS/Linux builds (see OQ4).
- Multi-user provisioning of any kind (Constitution Clause V stays dormant).
- WhatsApp channel (`whatsapp-bot`, port 30024, still only "planned" per
  `docs/ports.md` — not part of this installer regardless of how OQ5
  resolves for Telegram).
