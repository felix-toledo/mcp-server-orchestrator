# Spec — External execution: local terminal, SSH, HTTP/DB access

| | |
|---|---|
| **Status** | Draft — backlog, not yet clarified/planned (see §8 — 10 unresolved Open Questions, no `grill-with-docs` round has run yet) |
| **Group** | backend (new `services/ops-connector`) |
| **Depends on** | none new — registers as an additional MCP server in `orchestrator`'s existing multi-server `McpManager`/`mcp_config.json` support (already implemented for `filesystem`/`google-calendar`/`brave-search`) |
| **Depended on by** | none yet — a future `Agent.allowedTools` entry (`orchestrator/002-multi-agent`) would opt an agent into these tools once this ships |
| **Constitution clauses in play** | I (this spec is almost entirely Open Questions — see §8), III (Vitest, once planned), IV (Service Layer/DI expected to apply the same as every other service), V (formally dormant — single local user, no tenant boundary — but see §4: this capability strains the *spirit* of V sooner than anything else ALMA has shipped, because a free-text channel can act on ALMA's behalf without a second human ever reviewing the instruction) |

## 1. Goal

ALMA today can write notes, search the vault, and schedule reminders — all
low-blast-radius actions confined to ALMA's own data. Felix wants ALMA able
to act on infrastructure he actually manages day to day — a VPS, Docker
containers, an Nginx config, reading a log file, hitting an internal API,
running a read query against a database — the same category of capability
other agent frameworks ("OpenClaw"-style) expose via local terminal, SSH to
remote hosts, and generic API/DB connectors.

This spec exists to **capture and scope that request**, not to plan or
implement it. It is deliberately left in Draft/backlog status: the security
questions below are not yet answered, and per Constitution Clause I, a spec
with unanswered Open Questions does not advance to Plan.

## 2. Why a new service, not folded into `services/mcp-server`

Following the same reasoning `scheduler/001-agendas` §2 and
`telegram-bot/001-channel` gave for their own new services: this is a
distinct failure-mode and blast-radius domain, not a natural extension of
`mcp-server`'s existing tools (`createKnowledgeEntry`,
`searchKnowledgeEntries`, `createVaultFolder`, `scheduleReminder`,
`listReminders`, `cancelReminder` — all of them read/write ALMA's own data,
never someone else's shell or a remote host). Mixing "write a note" and "run
a shell command on a VPS" in the same process means a bug or a compromised
dependency in one blast-radius class threatens the other. A separate
service also gets its own lifecycle (can be started, stopped, or entirely
disabled without touching the tools ALMA already depends on for its core
memory/reminder loop) and its own MCP registration, the same architecture
`orchestrator`'s `McpManager` already uses for multiple independent MCP
servers (`mcp-server` over StreamableHTTP; `filesystem`/`google-calendar`/
`brave-search` over stdio, per `mcp_config.json`).

**Name**: `services/ops-connector` — plain, descriptive, matches
`docs/context.md`'s "no mythological names in code" rule and the existing
`kebab-case` service-folder convention (`knowledge-store`, `telegram-bot`).
"ops" reflects the actual use case Felix described (VPS/Docker/Nginx
operations), "connector" reflects that this service's job is brokering
access to *external* systems, same conceptual role `mcp-server` plays for
ALMA's own data.

**Port**: **`30027`** (`docs/ports.md`) — next free number in the registry,
claimed with status `planned` alongside this spec (see the edit to that
file in this same change). Marked `planned`, not `active` — this service
does not exist yet.

**Transport**: StreamableHTTP, same shape as `mcp-server`'s registration in
`orchestrator`'s `mcp_config.json` (a real, independently addressable
service — not a stdio subprocess like `filesystem`/`google-calendar`).

**Data ownership**: per ADR-0001's standing rule ("no service besides
`knowledge-store` touches Prisma"), any persistent config this service
needs (an SSH host registry, an HTTP/DB destination allowlist, whatever
allowlist mechanism §8 eventually resolves) is expected to live in
`knowledge-store` as new model(s), with `ops-connector` calling
`knowledge-store`'s HTTP API directly for that config — the same pattern
`telegram-bot` already uses for `TelegramLink`. This is stated as a
default, not re-opened as an Open Question, because it follows directly
from an already-decided repo-wide rule rather than a new business
decision.

## 3. User Story & Acceptance Criteria

**As the user**, I want ALMA able to run a command on my own machine, run a
command on a remote server I've already told it about, or call an API/query
a database I've already told it about — without ALMA being able to reach
anywhere or run anything I didn't explicitly allow.

Every AC below names a **working-title** tool/endpoint shape so a future
Plan has something concrete to start from — none of these shapes are final;
each references the Open Question that has to close before it can be
locked in.

- **AC1 — Local terminal execution.** A tool (working name
  `runLocalCommand`) executes a shell command on the machine `ops-connector`
  itself runs on and returns `{ stdout, stderr, exitCode }`. Execution is
  gated by an **allowlist** — the exact mechanism (a fixed list of
  permitted binaries? a pattern/regex allowlist? per-invocation manual
  approval? something else) is **not decided** — see OQ1. This AC cannot be
  planned until OQ1 closes: "run anything the LLM asks" is explicitly out
  of scope per the task that produced this spec.
- **AC2 — Remote execution over SSH.** A tool (working name
  `runRemoteCommand`) executes a command against a **pre-registered** host
  — never an arbitrary hostname/IP/credential supplied at call time, same
  "configured, not arbitrary destination" shape `telegram-bot/001-channel`
  AC2 already uses for its allowlisted usernames. Host registry ownership
  and shape: OQ4. Credential storage for the SSH key/password: OQ5.
- **AC3 — Generic HTTP API / database query access.** One or two tools
  (working names `callHttpApi` / `queryDatabase` — whether this is one tool
  or two is OQ6) reach a **pre-registered** set of API base URLs / DB
  connections, never an arbitrary destination passed at call time (same
  allowlist shape as AC2). Whether DB access is read-only, which DB engines
  are in scope for a first cut, and how destinations get registered: OQ6,
  OQ7.
- **AC4 — Confirmation before execution.** Whether any of AC1–AC3 requires
  an explicit user confirmation turn before the command actually executes
  (as opposed to firing immediately, the way `createKnowledgeEntry` and
  `scheduleReminder` already do) is **not decided** — OQ2. This is
  explicitly not assumed either way.
- **AC5 — Auditability.** Whether every execution attempt (permitted or
  denied by whatever allowlist OQ1 settles on) gets recorded somewhere
  Felix can review afterward, and where, is **not decided** — OQ8.

## 4. Security / Trust Model

ALMA's existing trust model is "single local user, no authentication"
(Constitution Clause V, dormant; `docs/context.md`'s resolved decision) —
the `KAA` header authenticates a *calling channel* (web, Telegram), not a
person, because there is only one person. That model already accepts real
risk in exchange for simplicity: `TelegramLink.botToken` is stored in
plaintext (`telegram-bot/001-channel` §5.1), and nothing in the reasoning
pipeline distinguishes "Felix typed this" from "this text arrived via
Telegram and could contain a prompt-injection payload embedded in, say, a
forwarded message or a scraped web page a `brave-search` tool call
returned."

**This spec is explicitly not extending that same reasoning to command
execution without saying so out loud.** Writing a note or scheduling a
reminder is reversible and confined to ALMA's own data — a bad outcome is
an unwanted `KnowledgeEntry` or a spurious Telegram message. Arbitrary (or
even scoped) shell/SSH execution is not reversible in the same way, and it
reaches systems outside ALMA's own data entirely — a VPS, a database, a
production API. The existing single-user/no-auth trust model was accepted
for a materially smaller blast radius than this. That gap does not get
closed by inference or analogy in this document — it's the entire content
of §8's Open Questions:

- **No allowlist design is assumed.** §3's ACs name tools, not policies —
  the actual gating mechanism (OQ1, OQ4, OQ7) is undecided.
- **No confirmation-flow design is assumed** (OQ2) — whether a human has to
  approve a command before it runs, and if so, how that surfaces on a
  channel as constrained as Telegram's plain-text reply, is unresolved.
- **No credential-storage decision is assumed** (OQ5) — `TelegramLink`'s
  plaintext precedent is not automatically extended to an SSH private key;
  whether that's acceptable here, given the difference in blast radius, is
  explicitly a question for Felix, not a default this document sets.
- **No default scope of "which agents/channels can reach these tools" is
  assumed** (OQ9) — `Agent.allowedTools` (`orchestrator/002-multi-agent`)
  already exists as a mechanism to restrict tool visibility per agent;
  whether these tools should default to deny-everywhere (opt-in per agent)
  rather than following the same default-allow shape other tools use today
  is an open call given the free-text/prompt-injection risk noted above.

## 5. Data & config needs (sketch — not a committed schema)

Conceptually, whatever ships here will need to persist, at minimum:

- A registry of allowlisted local commands/patterns (OQ1).
- A registry of remote hosts reachable over SSH — host, port, username, and
  a reference to wherever the credential itself is stored (OQ4, OQ5).
- A registry of allowlisted HTTP base URLs / DB connection targets (OQ6,
  OQ7).
- Optionally, an execution log/audit trail (OQ8).

No Prisma model is drafted here on purpose — the fields above depend on
decisions (OQ1, OQ4–OQ8) that haven't been made yet, and Clause I's rule
against guessing a business rule applies as much to a schema shape as to
an `if` statement. A concrete data model is Plan-phase work, once §8
closes.

## 6. Out of Scope — Future Work

- Any UI for managing allowlists/host registries/credentials
  (`frontend`'s eventual "Agentes y Skills"-style tab, or something new) —
  not scoped here; follows once the underlying model exists.
- Multi-user credential isolation — not applicable yet (Clause V dormant).
- Any execution target beyond local terminal, SSH, HTTP API, and database
  query (e.g. Docker's own API/SDK directly, Kubernetes) — Felix's own
  examples (VPS, Docker containers, Nginx logs) are reachable through
  terminal/SSH access to the host running them; a dedicated Docker/K8s
  connector is a possible future spec, not this one.
- WhatsApp or any channel besides what already exists — channel-level
  question, orthogonal to this spec.

## 7. Design note for the eventual Plan (non-binding)

Not a commitment — flagged here only so the eventual `plan.md` doesn't
start from zero: local-command, SSH, and HTTP/DB execution are three
concrete variants of "execute a scoped action against an external target,"
which is the shape `docs/design-patterns.md`'s Strategy Pattern exists for
(`ILlmProvider`/`LlmProviderFactory` is this repo's existing example of the
same shape). Nothing about that requires resolving any of §8's Open
Questions first, but it's worth Plan checking `docs/design-patterns.md`'s
adoption guidance before introducing three parallel services/tools instead
of one service with three `Strategy` implementations.

## 8. Open Questions — pending Clarify, nothing here is resolved

None of the below have been confirmed with Felix. Each blocks this spec
from advancing past Draft per Constitution Clause I. A future `planner`
run should resolve these via `grill-with-docs` before writing `plan.md`.

- **OQ1 — Local command allowlist mechanism.** A fixed list of permitted
  binaries/commands? A pattern/regex allowlist? Per-invocation manual
  approval? Something else? Who maintains the list, and through what
  interface (a config file, a frontend UI, a `knowledge-store`-owned DB
  table)?
- **OQ2 — Confirmation flow.** Does any tool in this service require an
  explicit human confirmation turn before it actually executes (as opposed
  to firing immediately, like `createKnowledgeEntry`/`scheduleReminder`
  already do)? If yes, what does that confirmation UX look like on the web
  chat vs. on Telegram's plain-text channel, given `telegram-bot` forwards
  raw free text into the reasoning pipeline?
- **OQ3 — Overlap with the existing `filesystem` MCP server.** `orchestrator`
  already has a `filesystem` MCP server configured (stdio, per
  `mcp_config.json`). Is "local terminal execution" a deliberately separate
  concern from file I/O (command execution vs. reading/writing files), or
  does Felix want some consolidation/boundary drawn between the two?
- **OQ4 — SSH host registry.** How are hosts registered (name, hostname/IP,
  port, username — anything else)? Confirmed to live in `knowledge-store`
  per §2's ADR-0001-derived default — but the exact shape of that model
  isn't decided.
- **OQ5 — SSH credential storage.** Private key or password, stored how?
  Plaintext (matching `TelegramLink.botToken`'s existing precedent), or
  something stronger (encrypted at rest, OS keychain, an external secrets
  manager)? If plaintext, is that acceptable to Felix given command
  execution's blast radius is materially larger than a bot token leaking?
- **OQ6 — HTTP/DB tool shape.** One generic tool or two separate ones
  (`callHttpApi` vs. `queryDatabase`)? Is database access read-only, or can
  it execute writes? Which database engines are in scope for a first cut —
  just Postgres (what ALMA itself already runs on), or others?
- **OQ7 — API/DB destination allowlist.** How are permitted base URLs / DB
  connection targets registered, and by whom — same registry mechanism as
  SSH hosts (OQ4), or a separate one?
- **OQ8 — Audit trail.** Does every execution attempt (permitted or denied)
  get logged/recorded somewhere reviewable afterward? If so, where — a new
  `knowledge-store` table surfaced in a future frontend tab, a plain log
  file, something else — or is this explicitly out of scope for a first
  cut?
- **OQ9 — Default reachability.** Are these tools available to every
  configured `Agent`/channel by default (matching how other MCP tools
  behave today), or should they default to **deny-everywhere** — opt-in
  per agent via `Agent.allowedTools` — given the free-text/prompt-injection
  risk highlighted in §4?
- **OQ10 — Execution limits.** Is there a timeout on how long a command may
  run, or a cap on how much output it may return, before `ops-connector`
  kills the process or truncates the response?
