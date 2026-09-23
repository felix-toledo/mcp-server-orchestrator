# Tasks — Agent teams

Base: [`plan.md`](./plan.md) §5. Depends on `knowledge-store/005-skills`
and `orchestrator/002-multi-agent` being implemented first.

- [x] **T1 — `knowledge-store`: `Team` schema + service + HTTP surface**:
  migration `20260917222644_add_skill_and_team` (one migration together
  with `knowledge-store/005-skills`' `Skill` model — both tables needed
  around the same time, same efficiency call this repo's earlier rounds
  already made more than once). `TeamService.create`/`update` both throw
  `CoordinatorNotAMemberError` (→ HTTP 400, not 500/404) when
  `coordinatorAgentId ∉ memberAgentIds` (AC1). `allowedSkillIds`'s
  `null`-vs-`[]` handling reuses `AgentService`'s already-solved
  `jsonOrNull` helper (exported from there) instead of re-deriving it.
  Tests: 8 in `teamService.test.ts` + 9 route tests in `server.test.ts`.
- [x] **T2 — `AgentRegistry`: `TeamConfig` + constructor extension**:
  constructor now `(agents, teams, baseGraphDeps)`. `toolHandlesFor`'s
  `fromTeamId` param (AC3 — narrows to that team's other members only),
  `teamHandlesFor` (AC5's `askTeam_<slug>` handles, self-exclusion),
  `isTeamHandle`. Tests: 6 new describe blocks in `AgentRegistry.test.ts`.
- [x] **T3 — `getOrBuildGraph`'s per-team dimension**: cache key became
  `` `${agentId}::${teamId ?? 'solo'}` ``. Additive skills (AC4) via a new
  `unionSkills` helper (dedup by id, team's own list wins on conflict —
  moot in practice since it's a union, not an override). Working-directory/
  project context (AC6/AC7) appended to the agent's own
  `systemPromptAddendum` via `buildTeamContextBlock`. Tests: covered
  together with T4 below (same `invokeTeam` integration tests exercise
  both).
- [x] **T4 — `invokeTeam` + `executeToolsOrAgents`'s team-handle branch**:
  AC5 (always resolves `coordinatorAgentId` first), AC8 (shared budget —
  reused the exact mechanism AC6 of `002` already relies on: `state`
  flows in unchanged). **Design decision beyond plan.md's own sketch**:
  member-to-member delegation *inside* a team (agent A, running as part
  of team T, calls teammate B via `askAgent_B`) needed a way to tell B's
  own graph construction "you're also running inside team T," or B would
  silently fall back to an unscoped solo run one hop in — breaking AC3/
  AC4/AC6 for anything past the first hop. Solved by adding
  `currentTeamId?: string` to `PipelineState` itself (set once by
  `invokeTeam`, then just an ordinary state field flowing through
  LangGraph unchanged) rather than threading a new parameter through
  `AgentRegistryLike.invoke`'s already-tested, fixed 2-arg signature.
  `executeToolsOrAgents`'s dispatch gained an `isTeamHandle`/`invokeTeam`
  branch — both added as *optional* members on `AgentRegistryLike` so the
  existing tests built against just `isAgentHandle`/`invoke` (from before
  teams existed) keep typechecking unchanged. Tests: `AgentRegistry.test.ts`
  covers AC3 (teammate-only tool visibility), AC4 (additive skills — a
  live check against the actual prompt sent to the SkillRouter), AC6/AC7
  (working directories + project summaries land in the system prompt),
  AC8 (nested delegation keeps the caller's iteration counter, not a
  fresh one).
- [x] **T5 — `graphRuntime.ts` wiring**: fetches `Agent[]`/`Team[]`/
  `Skill[]`/`VaultFolder[]` in one `Promise.all` per request (all four
  already fail-open to `[]` at the `KnowledgeStoreClient` layer — a
  `knowledge-store` hiccup degrades to "none of this round's features
  configured," never breaks the turn). `Team.projectFolderIds` resolved
  to `path: summary` text once here (`resolveProjectSummaries`), not
  inside `AgentRegistry` — keeps that class free of its own HTTP
  dependency, matching how `Agent[]`/`Skill[]` were already pre-fetched
  before construction. Root graph's `tools` now also merges
  `agentRegistry.teamHandlesFor(null)`, alongside the existing
  `toolHandlesFor(null)` — AC2-style parity (zero teams configured →
  byte-identical to not having this spec at all).
- [x] **T6 — Manual end-to-end**: created a real two-agent team live
  ("Equipo Internacional" — a coordinator instructed to delegate
  translation work, plus a translator member) and asked the *main* chat
  ("Que el equipo internacional traduzca la frase hola como estas al
  frances") with no restart needed (`graphRuntime.ts` fetches
  `Team[]`/`Agent[]` fresh per request). Confirmed the full chain: root
  graph recognized `askTeam_equipo_internacional` → dispatched to the
  coordinator first (AC5) → the coordinator used its own instructions to
  call `askAgent_traductor_del_equipo` → correct translation
  ("Salut, comment ça va ?") came back and was correctly persisted in the
  chat session. AC3's teammates-only visibility itself is covered by the
  `AgentRegistry.test.ts` unit tests (a live negative test — proving a
  handle is *absent* — isn't practical without invasive debug logging);
  the live run above proves the positive path the mechanism depends on.
  **Unrelated transient issue observed, not a regression**: the run hit a
  60s MCP timeout on the coordinator's own `searchKnowledgeEntries` RAG
  fetch (stale connection after an earlier mid-session `Sesión MCP
  inválida, reconectando` event, probably left over from an unrelated
  `mcp-server --watch` restart earlier in this session) — correctly
  failed open (`RAG top-20 falló, sigo sin candidatos`) and the rest of
  the graph, including the team delegation itself, completed and
  succeeded regardless. A direct `knowledge-store` search call made
  immediately after returned in under a second, confirming this was a
  one-off MCP transport hiccup, not a real backend slowdown.
- [x] **T7 — Frontend**: Felix flagged directly that there was no way to
  configure teams (or skills) from the UI at all — the backend/graph work
  above had shipped without it. Added `TeamList.tsx` to the same
  `/agents` page (new "Equipos" sub-tab, alongside a new "Skills" one —
  see `knowledge-store/005-skills` tasks.md T7 for that half of this same
  pass) — a create form with member checkboxes, a coordinator `<select>`
  restricted to just the checked members (and cleared automatically if
  its agent gets unchecked), one-path-per-line working directories, and
  project-folder checkboxes sourced from the existing
  `list-vault-folders` action. `list-teams`/`create-team`/`delete-team`
  server actions mirror the agent actions' shape;
  `createTeam`'s result surfaces the backend's real validation message
  (e.g. `CoordinatorNotAMemberError`) instead of a generic error. Tests:
  9 across the three new actions. Verified live: created a real
  agent + team through the exact payload shape the form sends, confirmed
  the server-rendered `/agents` page's HTML reflected it by name.

## Amendment (2026-09-17) — `workingDirectories` removed

Felix's own feedback after using T7's UI: the two folder concepts
("carpetas donde trabaja" — a raw OS path textarea, and "proyectos" — a
`VaultFolder` checkbox picker) were confusing, and typing a raw path was
bad UX ("me haces escribir ahi y es re gede"). Since `workingDirectories`
was always advisory-only text (AC6 never gave it real technical teeth —
confirmed in the same round: "pueden acceder a cualquiera pero yo le digo
bien dónde trabajan"), unifying around the one real, already-pickable
concept (`VaultFolder`/"proyectos") loses nothing functional.

- **AC1/AC6 revised**: `Team.workingDirectories` is removed — dropped from
  the Prisma model, `TeamService`, `TeamInputSchema`, `AgentRegistry`'s
  `TeamConfig`, `buildTeamContextBlock` (now only injects `projectSummaries`
  into the system prompt), `graphRuntime.ts`'s mapping, and every
  frontend action/component. `AC7`'s project-folder picker is now the
  *only* "where does this team work" concept, with a "+ Nueva carpeta"
  button next to it (`TeamList.tsx`, reuses the existing
  `createVaultFolder` action) so nothing needs to be typed as raw text
  anymore.
- **Migration**: `20260917233000_remove_team_working_dirs_add_telegram_allowlist`
  — written by hand and applied via `prisma migrate deploy`, not
  `migrate dev`, because Prisma's interactive drop-column confirmation
  can't run in a non-interactive session and there was a **real, non-test
  `Team` row already in the database** (Felix's own "empresa de algo") —
  confirmed its `memberAgentIds`/`coordinatorAgentId`/`projectFolderIds`
  survived intact before proceeding, not just assumed it would.
- Batched into the same migration: `TelegramLink.allowedUsernames` — see
  `telegram-bot/001-channel`'s own tasks.md amendment for that half.

## Amendment (2026-09-17) — team hierarchy (org chart), opt-in

Part of the same feature round as the `workingDirectories` removal above.
Felix's ask: "me gustaria poder armar equipos en formato de jerarquia tipo
organigrama para que los agentes sepan quienes se comunican con quienes, si
no se puede todo bien" — explicitly optional, so the default (no hierarchy
configured) stays the full-mesh behavior T2 already shipped.

- **`Team.hierarchy Json?`** (migration `20260918010526_add_team_hierarchy`,
  additive — no destructive-change hand-written SQL needed this time) —
  `HierarchyEntry[] | null`, `{ agentId, managerAgentId: string | null }`
  per member. `managerAgentId: null` marks the top of the chart (normally
  the coordinator). `TeamService.create`/`update` validate every entry's
  `agentId`/non-null `managerAgentId` is a real `memberAgentIds` member,
  throwing the new `InvalidHierarchyError` (→ HTTP 400) otherwise — same
  shape as T1's `CoordinatorNotAMemberError` handling in
  `teamsController.ts`. `jsonOrNull` (already generic from T1) is reused
  as-is. Tests: 8 new cases in `teamService.test.ts`.
- **`AgentRegistry.TeamConfig.hierarchy`** — `toolHandlesFor`'s
  `fromTeamId` narrowing (T2) is now hierarchy-aware: when the team has a
  hierarchy configured AND `fromAgentId` has an entry in it, visibility is
  narrowed further to that agent's manager + direct reports only (not the
  whole team). Two deliberate fallbacks to the pre-hierarchy full-mesh
  behavior, so a partial/absent hierarchy never *reduces* visibility below
  what T2 already gave: (1) `team.hierarchy === null` (unconfigured) — full
  mesh, unchanged; (2) `fromAgentId` has no entry in a *configured*
  hierarchy (a partial org chart) — that specific agent falls back to full
  mesh too, since a hierarchy that doesn't mention them shouldn't cut them
  off from everyone. Threaded through `graphRuntime.ts`'s `TeamConfig`
  mapping and both knowledge-store's and orchestrator's `TeamSummary`
  types. Tests: 2 new cases in `AgentRegistry.test.ts` (peer-to-peer
  visibility narrowed to just the shared manager; partial-hierarchy
  fallback).
- **Frontend**: `TeamList.tsx`'s create form grew an opt-in "reporta a"
  picker (extracted into `TeamHierarchyPicker.tsx` to keep `TeamList`'s own
  complexity down — that component was already near ESLint's
  `complexity` warning threshold before this addition) — one dropdown per
  non-coordinator member, defaulting to "— sin asignar —". The submitted
  `hierarchy` stays `null` unless at least one member actually got a
  manager picked, so creating a team without touching this section is
  byte-for-byte the same request T2 already sent. The team list shows
  "· con organigrama" once a hierarchy is configured.
- **Not done in this round** (out of scope, no user ask yet): no UI to
  *edit* an existing team's hierarchy — `TeamList.tsx` has no update
  action at all yet (create/delete only, matching `AgentList.tsx`'s own
  scope), so this is consistent with the rest of the Teams UI, not a new
  gap.

## Amendment (2026-09-18) — dedicated team chat

Felix's ask: "quiero empezar un chat o sesion con el equipo dentro de ahi,
no quiero ir al chat principal de alma para hacerlo desde ahi se entiende"
— a chat scoped to one team, started from the Teams tab itself, never
routing through the main ALMA chat.

- **`/api/inquire` gained an optional `teamId`** (`InquireRequestSchema`,
  `inquireController.ts`). When present, `graphRuntime.ts`'s
  `runReasoningGraph` dispatches straight to
  `agentRegistry.invokeTeam(teamId, ...)` — skipping the root graph's own
  tool/skill selection entirely, since the whole point of a dedicated team
  chat is that the *team* decides what to do with the message, not the
  general assistant. An unknown/deleted `teamId` degrades to a graceful
  assistant reply ("No pude encontrar ese equipo...") instead of a 500 —
  verified live.
- **`ChatSession.teamId String?`** (migration
  `20260918021045_add_chat_session_team_id`, additive) — plain id
  reference, no `@relation`, same loose style already used for
  `Team.memberAgentIds`/`coordinatorAgentId` (a `Team` being deleted
  should never cascade into deleting its past chat history).
  `ChatSessionService.create(teamId?)` tags the session;
  `ChatSessionService.list()` now filters `where: { teamId: null }` — the
  main chat sidebar has no UI for team-scoped sessions at all, so it never
  sees them. Reused knowledge-store's *existing but completely dead*
  `ChatSession.agentId` field's shape as precedent (`agentId` was in the
  schema from `knowledge-store/003-chat-sessions` but never wired into
  `create`/`list`/`getById` anywhere — confirmed by grep before adding
  `teamId` alongside it, so as not to repeat that half-finished pattern).
- **Frontend**: `TeamChatPanel.tsx` (new, under `components/agents/`, not
  `components/chat/` — deliberately not reusing `ChatSessionContext`, which
  is main-sidebar-specific) is a fully self-contained chat surface: its own
  message state, its own `sessionId`, opened inline per-team from a
  "Chatear" button in `TeamList.tsx`'s own list item. `send-team-chat-message.ts`
  mirrors `send-chat-message.ts` but always forwards `teamId`, kept as a
  separate action file specifically so the main chat's own action/tests are
  untouched.
- **Verified live**: real `POST /api/inquire` call with the real "empresa
  de algo" team's id got a direct reply from its coordinator; confirmed via
  `docker exec ... psql` that the created `ChatSession` row carries the
  right `teamId`, and confirmed via `GET /chat-sessions` that it does NOT
  appear in the main sidebar's own list. Test-only sessions deleted after
  verification; the real team itself was never touched.
