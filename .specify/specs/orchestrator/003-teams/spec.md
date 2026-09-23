# Spec — Agent teams

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (`services/orchestrator` graph extension, `services/knowledge-store` owns `Team` config) |
| **Depends on** | [`orchestrator/002-multi-agent`](../002-multi-agent/spec.md) (a Team reuses `AgentRegistry`'s delegation mechanism), [`knowledge-store/005-skills`](../../knowledge-store/005-skills/spec.md) (a Team's own skills) |
| **Depended on by** | `frontend/004-chat-shell` AC9 (Agentes y Skills tab gains Team CRUD) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

`orchestrator/002-multi-agent` gave every configured `Agent` a distinct
persona that can delegate to any other agent. This spec adds **Teams**: a
named group of `Agent`s that work toward a shared objective — a real-world
analogy Felix gave directly: "puedo tener un equipo de agentes que estén al
tanto de muchas cosas, por ejemplo una empresa." A Team scopes delegation to
its own members (not every agent in the system), has its own working
folder(s) and knowledge ("proyectos" — `VaultFolder`s), and is addressable
from the main chat the same way an individual agent already is.

## 2. User Story & Acceptance Criteria

**As the user**, I group existing agents into a named team, tell it which
folder(s) of my computer it works in and which vault folder(s) ("proyectos")
it should know about, and I can ask the main chat to have that team handle
something — the team's own coordinator figures out which member(s) actually
do the work.

- **AC1**: `Team` CRUD — `{ id, name, memberAgentIds: string[],
  coordinatorAgentId: string, workingDirectories: string[],
  projectFolderIds: string[], allowedSkillIds: string[] | null }`.
  `coordinatorAgentId` must be one of `memberAgentIds` (AC5 needs it to be
  a real member).
- **AC2**: **Membership is many-to-many** — an `Agent` can belong to
  multiple `Team`s at once, confirmed 2026-09-17. No exclusivity constraint
  anywhere in the data model.
- **AC3**: **Scoped visibility** — when an `Agent` is running *as part of a
  team* (i.e., this request reached it via that team), the `askAgent_<slug>`
  handles it sees (`orchestrator/002-multi-agent` AC4) are restricted to
  its **teammates only**, not every configured `Agent` in the system. The
  self-exclusion rule from AC4 there still applies on top of this (never a
  handle to call itself).
- **AC4**: **Team-level skills are additive** — a member agent running
  inside a team has its own `allowedSkills` **plus** the team's
  `allowedSkillIds`, never one replacing the other. Confirmed 2026-09-17.
- **AC5**: **Fixed coordinator entry point** — `askTeam_<slug>` (the handle
  every *other* team or top-level agent sees for this team, same naming
  convention as `askAgent_<slug>`) always dispatches to the team's
  `coordinatorAgentId` first. That agent decides whether to answer directly
  or delegate to teammates via the scoped `askAgent_` handles from AC3 —
  no separate "team orchestration" logic beyond that first hop landing on
  the coordinator instead of directly on the requester's target.
- **AC6**: **Working directories are advisory, not enforced** — Felix
  confirmed explicitly: "pueden acceder a cualquiera pero yo le digo bien
  donde trabajan." A team's `workingDirectories` are injected into its
  coordinator's (and, when running as part of that team, its members')
  system prompt context as "where you work," the same trust model the rest
  of this single-user, no-auth system already uses — **not** a technical
  restriction on the `filesystem` MCP tool, which keeps whatever directories
  it was already configured with globally. Getting real per-team filesystem
  isolation would mean running a separate `filesystem` MCP server instance
  per team, which is explicitly not what Felix asked for.
- **AC7**: **Projects are `VaultFolder`s** — confirmed 2026-09-17: "puede
  ser tranquilamente una carpeta dentro de mi vault y ahí hay mucho
  conocimiento." A `Team`'s `projectFolderIds` reference existing
  `VaultFolder` rows (`knowledge-store/004-vault-folders-and-llm-summaries`)
  — no new project entity. A Team can reference **multiple** project
  folders (AC1's array), confirmed.
- **AC8**: **Shared iteration budget** — a team's own coordinator hop and
  any subsequent member-to-member delegation inside it share the exact same
  budget/counter `orchestrator/002-multi-agent` AC6 already established for
  individual agent-to-agent calls — no separate counter per team.

## 3. Where this plugs into the graph

`AgentRegistry` (`orchestrator/002-multi-agent` §2) is extended, not
replaced:

```
AgentRegistry
├── toolHandlesFor(fromAgentId, fromTeamId?)
│     — fromTeamId present: only that team's OTHER members (AC3)
│     — fromTeamId absent: every configured Agent (unchanged AC4 behavior)
├── teamHandlesFor(fromAgentId, fromTeamId?)
│     — every OTHER configured Team (askTeam_<slug>), same self-exclusion
│       shape as agent handles — a team is never offered a handle to
│       itself
└── invokeTeam(teamHandleOrId, state)
      → resolves the team's coordinatorAgentId, invokes it with
        fromTeamId set so its own graph gets the scoped tool list (AC3),
        additive skills (AC4), and working-directory context (AC6)
```

No new LangGraph node type — a "team-scoped" agent run is the exact same
`buildReasoningGraph` call `AgentRegistry.getOrBuildGraph` already makes for
an individual agent, just with a different `tools`/`systemPromptAddendum`/
`availableSkills` computation (teammates instead of everyone, additive
skills, working-directory context appended). `getOrBuildGraph` gains a
second cache dimension (`agentId` × `teamId | null`) since the same agent's
graph looks different depending on whether it's running solo or as part of
a given team.

## 4. `knowledge-store` — `Team` CRUD

| Method & path | Body | Returns |
|---|---|---|
| `POST /teams` | `{ name, memberAgentIds, coordinatorAgentId, workingDirectories, projectFolderIds, allowedSkillIds? }` | `201 Team` |
| `GET /teams` | — | `200 Team[]` |
| `GET /teams/:id` | — | `200 Team` or `404` |
| `PUT /teams/:id` | same shape as create | `200 Team` |
| `DELETE /teams/:id` | — | `204` |

```prisma
model Team {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id])
  name               String
  memberAgentIds     Json     // string[], at least one — coordinatorAgentId must be in this list
  coordinatorAgentId String
  workingDirectories Json     // string[] — advisory only, AC6
  projectFolderIds   Json     // string[] — VaultFolder ids, AC7
  allowedSkillIds    Json?    // string[] | null — null = every Skill (AC4's additive set)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

`memberAgentIds`/`workingDirectories`/`projectFolderIds` are `Json`, not
native relations — same reasoning `orchestrator/002-multi-agent` plan.md §1
already gave for `Agent.allowedTools`: avoids a join-table explosion for
what's fundamentally an ordered/unordered id list, and (for
`workingDirectories`) there's no local table a filesystem path could
reference anyway.

## 5. Design patterns applied

- **Module Pattern**: `AgentRegistry` stays the single place team-scoped
  delegation logic lives, same as it already is for plain agent-to-agent —
  no separate `TeamRegistry`.
- **Dependency Injection**: `Team[]` fetched and injected into
  `AgentRegistry`'s constructor alongside `Agent[]`, same lifecycle
  (rebuilt per request in `graphRuntime.ts`).
- No Factory: team-scoped vs. solo agent graph construction is two
  concrete shapes of the same `getOrBuildGraph` method, not a family of
  variants — consistent with `docs/design-patterns.md`'s adoption guidance
  already applied to the pipeline-vs-full-graph branch in `002`.

## 6. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `TeamService` (mocked `PrismaClient`) | AC1 CRUD, `coordinatorAgentId` must be a member (validation) |
| `teamsController` (supertest) | one test per endpoint/status |
| `AgentRegistry.toolHandlesFor` with a `fromTeamId` | AC3 — only teammates, self still excluded |
| `AgentRegistry.teamHandlesFor` | every other team, self-exclusion |
| `AgentRegistry.invokeTeam` | AC5 (lands on coordinator first), AC8 (shared budget) |
| `getOrBuildGraph`'s per-team cache dimension | same agent gets a different graph solo vs. inside a given team |

## 7. Out of Scope — Future Work

- Real filesystem isolation per team (AC6 — advisory only this round).
- Team-to-team nesting beyond one hop (a team's coordinator delegating to
  another team's `askTeam_` handle is allowed by the mechanism, but no
  explicit cycle/depth analysis beyond the existing shared iteration budget
  was done this round — AC8's budget is the only safety net).
- Multimodal team capabilities (images/audio) — deferred repo-wide, not
  specific to teams.
- Natural-language team creation, team templates.

## 8. Open Questions — resolved 2026-09-17

- **OQ1 — Membership cardinality** → **Many-to-many** (AC2).
- **OQ2 — Reuse `Agent`/`AgentRegistry` mechanism or build separate team
  orchestration?** → **Reuse**, confirmed after Felix clarified the actual
  goal ("cada agente se comporte como alguien distinto, que entre todos
  puedan hacer un objetivo en común") — exactly what scoped `askAgent_`
  delegation between teammates already produces with no new mechanism.
- **OQ3 — Entry point on `askTeam_` invocation** → **Fixed coordinator**
  (AC5), not a dynamic/unled dispatch — simpler, predictable, and
  consistent with how individual delegation already works.
- **OQ4 — Working directories: how many, how enforced?** → **One or more,
  advisory only** (AC6).
- **OQ5 — Projects: how many, what entity?** → **One or more existing
  `VaultFolder`s** (AC7).
- **OQ6 — Team skills semantics** → **Additive** to each member's own
  (AC4).
