# Plan — Agent teams

Base: [`spec.md`](./spec.md), builds on
[`orchestrator/002-multi-agent`](../002-multi-agent/plan.md)'s
`AgentRegistry`. Contracts below are signatures only.

## 1. `knowledge-store`

`TeamService` (`src/services/teamService.ts`) + `teamsController.ts` +
`TeamInputSchema` — same CRUD shape as `AgentService`, plus one piece of
real validation `create`/`update` both need: `coordinatorAgentId` must
appear in `memberAgentIds` (AC1). `allowedSkillIds` follows the same
`null`-vs-`[]` Json-column handling `AgentService.jsonOrNull` already
solved (`orchestrator/002-multi-agent` tasks.md T1) — reused directly, not
re-derived.

```typescript
export interface TeamInput {
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  workingDirectories: string[];
  projectFolderIds: string[];
  allowedSkillIds?: string[] | null;
}

export class TeamService {
  constructor(private readonly prisma: PrismaClient, private readonly userService: UserService) {}
  create(input: TeamInput): Promise<Team>;   // throws if coordinatorAgentId ∉ memberAgentIds
  list(): Promise<Team[]>;
  getById(id: string): Promise<Team | null>;
  update(id: string, input: TeamInput): Promise<Team>;
  delete(id: string): Promise<void>;
}
```

## 2. `orchestrator` — `AgentRegistry` extension

```typescript
// src/agents/AgentRegistry.ts — extended, not replaced
export interface TeamConfig {
  id: string;
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  workingDirectories: string[];
  projectFolderIds: string[];        // VaultFolder ids — resolved to paths/summaries at invoke time
  allowedSkillIds: string[] | null;
}

export class AgentRegistry {
  constructor(
    agents: AgentConfig[],
    teams: TeamConfig[],                 // new
    baseGraphDeps: ReasoningGraphDeps,
  ) { /* ... */ }

  // AC3 — fromTeamId present narrows to that team's other members;
  // absent keeps 002's existing "every other agent" behavior.
  toolHandlesFor(fromAgentId: string | null, fromTeamId?: string): LlmToolDefinition[];

  // AC5's askTeam_<slug> handles, exposed to every OTHER team/agent (self-exclusion, same shape as agent handles).
  teamHandlesFor(fromTeamId: string | null): LlmToolDefinition[];

  isTeamHandle(name: string): boolean;

  // AC5 — always lands on the team's coordinatorAgentId first.
  async invokeTeam(teamIdOrHandle: string, state: PipelineState): Promise<LlmMessage>;

  // getOrBuildGraph's cache key becomes `${agentId}::${teamId ?? 'solo'}` —
  // the same Agent's compiled graph differs depending on which team (if
  // any) it's running inside (AC3/AC4/AC6's context differs per team).
  private getOrBuildGraph(agentId: string, teamId?: string): CompiledAgentGraph;
}
```

`executeToolsOrAgents` (`001`'s node): before falling back to
`McpManager.callTool`, check `agentRegistry.isAgentHandle` (existing) **or**
`agentRegistry.isTeamHandle` (new) — `isTeamHandle` dispatches to
`invokeTeam` instead of `invoke`. Same `stripDanglingToolCall` sanitization
from `002` applies identically (it operates on `state.messages`, not on
which kind of handle was matched).

### 2.1 What "running inside team X" actually changes for a member agent

When `getOrBuildGraph(agentId, teamId)` builds a team-scoped run:

- **`tools`**: `restrictTools(baseTools, agent.allowedTools)` +
  `toolHandlesFor(agent.id, teamId)` (AC3 — teammates only) +
  `teamHandlesFor(...)` is **not** added here — a member agent doesn't
  itself get `askTeam_` handles, only the requester that reached the team
  in the first place does (AC5 — the team is one addressable unit from
  outside, not "everyone inside sees every other team too").
- **`availableSkills`**: `agent.allowedSkills` (or every skill if `null`)
  **union** `team.allowedSkillIds` (AC4 — additive, never a replacement).
- **`systemPromptAddendum`**: `agent.systemPromptAddendum` +
  a generated block listing the team's `workingDirectories` ("Tu equipo
  trabaja en las siguientes carpetas: ...", AC6 — advisory text, not a
  tool restriction) and a short summary of each `projectFolderIds`
  `VaultFolder` (AC7 — fetched once per `invokeTeam` call, not re-fetched
  per graph node).

## 3. Design patterns applied

See spec.md §5 — Module Pattern (`AgentRegistry` stays the single
delegation authority) and no Factory (two concrete graph shapes: solo vs.
team-scoped, same as `002`'s pipeline-vs-full split).

## 4. Test strategy (Vitest)

See spec.md §6. Additional integration-style check carried over from
`002`'s own precedent: `AgentRegistry.invokeTeam` tested against a real
(fake-dep-backed) compiled graph, not fully mocked, since that's what
actually caught the dangling-tool-call bug in `002` — the same class of
bug is plausible here too (a team's coordinator delegating to a teammate
mid-tool-call).

## 5. Build order (→ `tasks.md`)

1. `knowledge-store`: `Team` schema + `TeamService` (with the
   coordinator-is-a-member validation) + controller/routes + tests.
2. `AgentRegistry`: `TeamConfig`, constructor takes `teams: TeamConfig[]`,
   `toolHandlesFor`'s `fromTeamId` parameter, `teamHandlesFor`,
   `isTeamHandle`. Tests.
3. `getOrBuildGraph`'s per-team cache dimension + the additive-skills/
   working-directory/project-summary context assembly (§2.1). Tests.
4. `invokeTeam` (AC5/AC8) + `executeToolsOrAgents`'s `isTeamHandle` branch.
   Tests, including a dangling-tool-call regression test mirroring `002`'s.
5. `graphRuntime.ts`: fetch `Team[]` alongside `Agent[]`, pass both into
   `AgentRegistry`, merge `teamHandlesFor(null)` into the root graph's
   tools (same reasoning `002`'s `toolHandlesFor(null)` merge already
   used — AC2 there: zero teams configured must be byte-identical to
   having none of this spec at all).
6. `frontend/004-chat-shell` AC9's Team CRUD UI (separate spec's task
   list — nothing there can land before this spec's endpoints exist).
7. Manual end-to-end: create a two-agent team with a coordinator, ask the
   main chat to have the team do something that requires both members,
   confirm the coordinator receives it first and delegates internally
   (teammates-only visibility — confirm a non-teammate agent's handle is
   genuinely absent from what the coordinator sees).
