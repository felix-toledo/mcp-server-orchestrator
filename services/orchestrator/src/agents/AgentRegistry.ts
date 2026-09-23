import { buildReasoningGraph, type ReasoningGraphDeps } from '../graph/buildReasoningGraph.js';
import type { AgentRegistryLike } from '../graph/nodes/executeToolsOrAgents.js';
import { ITERATION_LIMIT_MESSAGE } from '../graph/nodes/finalizeResponse.js';
import type { PipelineState } from '../graph/state.js';
import type { LlmMessage, LlmToolDefinition } from '../llm/ILlmProvider.js';
import type { SkillSummary } from '../skills/SkillManager.js';
import { buildPipelineAgentGraph } from './buildPipelineAgentGraph.js';

/**
 * 2026-09-18 — how many hops deep agent-to-agent delegation may go in a
 * single user turn, regardless of direction (A→B, or a genuine cycle like
 * A→B→A→B…). See `invoke()`'s own doc comment for why this is a separate,
 * much smaller cap than the general `iterationCount`/`maxIterations` tool
 * budget (10) rather than reusing it — 2 is generous for any real "ask a
 * teammate, maybe they ask one more for a detail" pattern, while still
 * keeping a runaway mutual-delegation chain to a handful of real LLM calls
 * instead of dozens. Paired with `executeToolsOrAgents.ts`'s own fix
 * (treating a maxed-out delegation as a `failed` tool result, not just an
 * ordinary one) — without that, each level's own retry budget could still
 * spawn a fresh, fully-depthed subtree per retry, multiplying rather than
 * bounding the total real LLM calls even with this cap in place.
 */
const MAX_DELEGATION_DEPTH = 2;

export interface AgentConfig {
  id: string;
  name: string;
  systemPromptAddendum: string;
  allowedTools: string[] | null;
  allowedSkills: string[] | null;
  pipelineSteps: string[] | null;
}

/** orchestrator/003-teams hierarchy amendment — one org-chart edge. `managerAgentId: null` marks the top of the chart (typically the coordinator). */
export interface HierarchyEntry {
  agentId: string;
  managerAgentId: string | null;
}

/**
 * orchestrator/003-teams — `projectFolderIds` are resolved to readable
 * text (`${path}: ${summary}`) once, in `graphRuntime.ts`, rather than
 * carried as raw ids here — `AgentRegistry` stays a pure in-memory
 * construction from arrays, same as it already is for `AgentConfig[]`,
 * with no `knowledge-store` HTTP dependency of its own.
 */
export interface TeamConfig {
  id: string;
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  /** hierarchy amendment — `null`/unconfigured means full mesh (every member sees every other), the original default. */
  hierarchy: HierarchyEntry[] | null;
  projectSummaries: string[];
  allowedSkillIds: string[] | null;
}

type CompiledAgentGraph = { invoke: (state: PipelineState) => Promise<PipelineState> };

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** AC4 (orchestrator/002-multi-agent) — the handle name for another configured agent. */
export function agentHandleName(agent: Pick<AgentConfig, 'name'>): string {
  return `askAgent_${slugify(agent.name)}`;
}

/** AC5 (orchestrator/003-teams) — the handle name for a configured team. */
export function teamHandleName(team: Pick<TeamConfig, 'name'>): string {
  return `askTeam_${slugify(team.name)}`;
}

function restrictTools(tools: LlmToolDefinition[], allowedTools: string[] | null): LlmToolDefinition[] {
  return allowedTools === null ? tools : tools.filter((t) => allowedTools.includes(t.name));
}

function restrictSkills(skills: SkillSummary[], allowedSkillIds: string[] | null): SkillSummary[] {
  return allowedSkillIds === null ? skills : skills.filter((s) => allowedSkillIds.includes(s.id));
}

/**
 * hierarchy amendment — narrows visibility to direct reports + manager when
 * `fromAgentId` has an entry in `team.hierarchy`. Falls back to the full
 * candidate list (full mesh) when the team has no hierarchy configured, or
 * when `fromAgentId` isn't listed in it — a partial hierarchy should never
 * *reduce* visibility for the agents it doesn't mention, only for the ones
 * it explicitly places.
 */
function narrowToHierarchy(candidates: AgentConfig[], team: TeamConfig, fromAgentId: string): AgentConfig[] {
  if (!team.hierarchy) {
    return candidates;
  }
  const ownEntry = team.hierarchy.find((entry) => entry.agentId === fromAgentId);
  if (!ownEntry) {
    return candidates;
  }
  const visibleIds = new Set<string>();
  if (ownEntry.managerAgentId) {
    visibleIds.add(ownEntry.managerAgentId);
  }
  for (const entry of team.hierarchy) {
    if (entry.managerAgentId === fromAgentId) {
      visibleIds.add(entry.agentId);
    }
  }
  return candidates.filter((agent) => visibleIds.has(agent.id));
}

/** orchestrator/003-teams AC4 — additive: a team's own skills never replace a member's, they add to them. */
function unionSkills(a: SkillSummary[], b: SkillSummary[]): SkillSummary[] {
  const byId = new Map(a.map((s) => [s.id, s]));
  for (const skill of b) byId.set(skill.id, skill);
  return [...byId.values()];
}

/** orchestrator/003-teams AC7 — project (vault folder) context, appended to the agent's own systemPromptAddendum. */
function buildTeamContextBlock(team: TeamConfig): string {
  return team.projectSummaries.length > 0
    ? `Conocimiento de base del equipo "${team.name}":\n${team.projectSummaries.join('\n')}`
    : '';
}

function stripDanglingToolCall(messages: PipelineState['messages']): PipelineState['messages'] {
  const last = messages[messages.length - 1];
  return last?.role === 'assistant' && (last.toolCalls?.length ?? 0) > 0 ? messages.slice(0, -1) : messages;
}

/**
 * orchestrator/002-multi-agent §3 / orchestrator/003-teams §3 — builds
 * (and memoizes) one compiled subgraph per configured `Agent`, and is the
 * dispatch target `executeToolsOrAgents` (001's node) routes to instead of
 * `McpManager` when a requested tool name matches an `askAgent_<slug>` or
 * `askTeam_<slug>` handle.
 *
 * `invoke` accepts either a raw Agent id (used internally by
 * `buildPipelineAgentGraph`'s fixed-sequence steps) or a handle name (used
 * by `executeToolsOrAgents`). `state.currentTeamId`, if set, makes `invoke`
 * build the target agent's *team-scoped* graph instead of its solo one —
 * this is what keeps a team's scoping (AC3/AC4/AC6) intact across
 * member-to-member delegation, not just on the first hop into the team.
 */
export class AgentRegistry implements AgentRegistryLike {
  private readonly graphs = new Map<string, CompiledAgentGraph>();
  private readonly byId = new Map<string, AgentConfig>();
  private readonly byHandleName = new Map<string, AgentConfig>();
  private readonly byTeamId = new Map<string, TeamConfig>();
  private readonly byTeamHandleName = new Map<string, TeamConfig>();

  constructor(
    private readonly agents: AgentConfig[],
    private readonly teams: TeamConfig[],
    private readonly baseGraphDeps: ReasoningGraphDeps,
  ) {
    for (const agent of agents) {
      this.byId.set(agent.id, agent);
      this.byHandleName.set(agentHandleName(agent), agent);
    }
    for (const team of teams) {
      this.byTeamId.set(team.id, team);
      this.byTeamHandleName.set(teamHandleName(team), team);
    }
  }

  isAgentHandle(name: string): boolean {
    return this.byHandleName.has(name);
  }

  isTeamHandle(name: string): boolean {
    return this.byTeamHandleName.has(name);
  }

  /**
   * AC4 (002) — every OTHER configured agent, never a handle to call
   * yourself. AC3 (003) — when `fromTeamId` is given, narrowed to that
   * team's other members only, not every agent in the system. Hierarchy
   * amendment — further narrowed to `fromAgentId`'s manager + direct
   * reports when that team has an org chart configured.
   */
  toolHandlesFor(fromAgentId: string | null, fromTeamId?: string): LlmToolDefinition[] {
    const team = fromTeamId ? this.byTeamId.get(fromTeamId) : undefined;
    const members = team
      ? team.memberAgentIds.map((id) => this.byId.get(id)).filter((agent): agent is AgentConfig => Boolean(agent))
      : this.agents;

    const candidates = team && fromAgentId ? narrowToHierarchy(members, team, fromAgentId) : members;

    return candidates
      .filter((agent) => agent.id !== fromAgentId)
      .map((agent) => ({
        name: agentHandleName(agent),
        description: `Delegar en el agente configurado "${agent.name}". ${agent.systemPromptAddendum}`.trim(),
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Lo que le pedís a este agente.' },
          },
          required: ['message'],
        },
      }));
  }

  /** AC5 (003) — every OTHER configured team; never a handle to call yourself. */
  teamHandlesFor(fromTeamId: string | null): LlmToolDefinition[] {
    return this.teams
      .filter((team) => team.id !== fromTeamId)
      .map((team) => ({
        name: teamHandleName(team),
        description: `Delegar en el equipo configurado "${team.name}".`,
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Lo que le pedís a este equipo.' },
          },
          required: ['message'],
        },
      }));
  }

  /**
   * AC6 (002) — `state` (iterationCount/maxIterations/isFailing) flows in
   * unchanged, so a nested run shares the parent's own tool-call budget.
   *
   * 2026-09-18 — real bug found live, separate from that budget: two
   * agents in the same team, each asked something, kept delegating
   * straight back to whoever just asked them ("le pregunto a los dos" —
   * including the one already on the line) instead of ever answering.
   * That's unbounded *recursion* across separate `graph.invoke()` calls,
   * confirmed running 150+ seconds with no end in sight. Tried reusing
   * `iterationCount`/`maxIterations` as the guard first (spend one unit
   * eagerly, check upfront) — it technically terminates, but far too
   * loosely: each retry within a calling agent's own 10-round budget can
   * spawn a whole fresh nested subtree, so total real LLM calls grow
   * combinatorially with depth, not linearly — still minutes long in
   * practice, a bad fix for a chat UX. `MAX_DELEGATION_DEPTH` is a
   * separate, deliberately small, dedicated cap on delegation *depth*
   * specifically (not the general tool-call budget, which stays exactly
   * as AC6 originally specified) — this is the one place every hop of
   * agent-to-agent delegation passes through, so it's checked and spent
   * here only.
   */
  async invoke(idOrHandle: string, state: PipelineState): Promise<LlmMessage> {
    const agent = this.byId.get(idOrHandle) ?? this.byHandleName.get(idOrHandle);
    if (!agent) {
      throw new Error(`Unknown agent: ${idOrHandle}`);
    }

    if (state.delegationDepth >= MAX_DELEGATION_DEPTH) {
      return { role: 'assistant', content: ITERATION_LIMIT_MESSAGE };
    }

    const graph = this.getOrBuildGraph(agent.id, state.currentTeamId);
    // Real bug found live (2026-09-17): when a caller's own executeToolsOrAgents
    // node dispatches here, `state.messages` still ends with the caller's own
    // assistant message carrying the *unresolved* tool_calls entry for this
    // very delegation (its matching tool-result message hasn't been appended
    // yet — that's this call's job). Handing that straight to the sub-agent's
    // own callLlm sends a dangling tool_calls message to the LLM API, which
    // OpenAI/DeepSeek reject outright (400: "must be followed by tool
    // messages"). The sub-agent only needs the conversation up to the point
    // of delegation, not the caller's own bookkeeping message.
    const result = await graph.invoke({
      ...state,
      messages: stripDanglingToolCall(state.messages),
      delegationDepth: state.delegationDepth + 1,
    });
    return result.finalResponse ?? { role: 'assistant', content: null };
  }

  /** AC5 (003) — askTeam_<slug> always lands on the team's coordinatorAgentId first. */
  async invokeTeam(teamIdOrHandle: string, state: PipelineState): Promise<LlmMessage> {
    const team = this.byTeamId.get(teamIdOrHandle) ?? this.byTeamHandleName.get(teamIdOrHandle);
    if (!team) {
      throw new Error(`Unknown team: ${teamIdOrHandle}`);
    }
    return this.invoke(team.coordinatorAgentId, { ...state, currentTeamId: team.id });
  }

  private getOrBuildGraph(agentId: string, teamId?: string): CompiledAgentGraph {
    const cacheKey = `${agentId}::${teamId ?? 'solo'}`;
    const cached = this.graphs.get(cacheKey);
    if (cached) {
      return cached;
    }

    const agent = this.byId.get(agentId);
    if (!agent) {
      throw new Error(`Unknown agent id: ${agentId}`);
    }
    const team = teamId ? this.byTeamId.get(teamId) : undefined;

    // AC5 (002) — a pipeline agent's own graph is a fixed sequence, not an
    // LLM-driven tool-calling loop; anything else gets the full graph
    // scoped to this agent's allowedTools/allowedSkills/systemPromptAddendum,
    // additionally narrowed to `team`'s context when running inside one.
    const graph: CompiledAgentGraph = agent.pipelineSteps
      ? buildPipelineAgentGraph(agent.pipelineSteps, this)
      : buildReasoningGraph({
          ...this.baseGraphDeps,
          tools: [
            ...restrictTools(this.baseGraphDeps.tools, agent.allowedTools),
            ...this.toolHandlesFor(agent.id, team?.id),
          ],
          availableSkills: team
            ? unionSkills(
                restrictSkills(this.baseGraphDeps.skillManager.list(), agent.allowedSkills),
                restrictSkills(this.baseGraphDeps.skillManager.list(), team.allowedSkillIds),
              )
            : restrictSkills(this.baseGraphDeps.skillManager.list(), agent.allowedSkills),
          systemPromptAddendum: team
            ? [agent.systemPromptAddendum, buildTeamContextBlock(team)].filter(Boolean).join('\n\n')
            : agent.systemPromptAddendum,
          agentRegistry: this,
        });

    this.graphs.set(cacheKey, graph);
    return graph;
  }
}
