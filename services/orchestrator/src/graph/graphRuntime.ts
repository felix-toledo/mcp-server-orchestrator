import { AgentRegistry, type AgentConfig, type TeamConfig } from '../agents/AgentRegistry.js';
import { buildReasoningGraph } from './buildReasoningGraph.js';
import type { ILlmProvider, LlmMessage } from '../llm/ILlmProvider.js';
import { LlmProviderFactory } from '../llm/LlmProviderFactory.js';
import { KnowledgeStoreClient, type VaultFolderSummary } from '../knowledge/knowledgeStoreClient.js';
import { McpManager } from '../mcp/McpManager.js';
import { TransformersJsReranker } from '../retrieval/Reranker.js';
import type { Reranker } from '../retrieval/Reranker.js';
import { labelForNode, setInquireStatus } from './inquireStatusStore.js';
import type { PipelineState } from './state.js';
import { SkillManager } from '../skills/SkillManager.js';
import { DefaultSkillRouter } from '../skills/SkillRouter.js';
import type { SkillRouter } from '../skills/SkillRouter.js';

/**
 * Composition root for the LangGraph reasoning pipeline
 * (orchestrator/001-reasoning-pipeline) — replaces the old `Orchestrator`
 * class. Collaborators that are expensive to construct (the reranker loads
 * a local ONNX model) are built once and reused; `McpManager`'s tool
 * registry, `Agent`/`Team`/`Skill` config, and `VaultFolder` summaries are
 * all re-read per request so an edit made from the Settings UI is picked
 * up without a restart, matching the old class's behavior.
 */
let mcpManager: McpManager | null = null;
let llmProvider: ILlmProvider;
let smallLlmProvider: ILlmProvider;
let skillRouter: SkillRouter;
let reranker: Reranker;
const knowledgeStoreClient = new KnowledgeStoreClient(process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025');

// A single in-flight promise every caller awaits — not a boolean flag.
// A flag flipped *before* the async work finishes left a real race: the
// background pre-warm call in index.ts set it true immediately, and the
// very first real request landed in that window, saw "already
// initialized," and skipped waiting — getting `mcpManager === null` and
// the "no tools available" fallback even though MCP was mid-connect, not
// actually down. Confirmed live (2026-09-17) before this fix.
let initPromise: Promise<void> | null = null;

async function doInitialize(): Promise<void> {
  llmProvider = LlmProviderFactory.createDefault();
  smallLlmProvider = LlmProviderFactory.createSmall();
  skillRouter = new DefaultSkillRouter(smallLlmProvider);
  reranker = new TransformersJsReranker();

  try {
    mcpManager = await McpManager.fromConfig();
    const tools = mcpManager.getAllTools();
    if (tools.length > 0) {
      console.log(`🔧 Herramientas disponibles: ${tools.map((t) => t.name).join(', ')}`);
    } else {
      console.warn('⚠️ Se conectaron servidores MCP pero no se encontraron herramientas.');
    }
  } catch (error) {
    mcpManager = null;
    console.warn('⚠️ No se pudieron cargar servidores MCP. El LLM funcionará sin herramientas.');
    console.warn(`   Detalle: ${error instanceof Error ? error.message : error}`);
  }
}

export function initializeGraphRuntime(): Promise<void> {
  if (!initPromise) {
    initPromise = doInitialize();
  }
  return initPromise;
}

/** orchestrator/003-teams AC7 — a Team's projectFolderIds resolved to readable "path: summary" lines. */
function resolveProjectSummaries(projectFolderIds: string[], folders: VaultFolderSummary[]): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return projectFolderIds
    .map((id) => byId.get(id))
    .filter((f): f is VaultFolderSummary => Boolean(f))
    .map((f) => `${f.path}: ${f.summary}`);
}

/**
 * team-chat amendment — a dedicated team chat skips the root graph
 * entirely and dispatches straight to that team's coordinator; an
 * unknown/deleted teamId degrades to a graceful reply instead of a 500.
 * Split out of `runReasoningGraph` to keep that function's own branching
 * (mcp-unavailable / team-chat / root graph) readable at a glance.
 */
async function invokeTeamChat(
  agentRegistry: AgentRegistry,
  teamId: string,
  messages: LlmMessage[],
  requestId?: string,
): Promise<LlmMessage> {
  if (requestId) {
    setInquireStatus(requestId, 'consultando al equipo…');
  }
  try {
    return await agentRegistry.invokeTeam(teamId, {
      messages,
      ragTop20: [],
      rerankedTop5: [],
      profileNote: null,
      hasSufficientInfo: false,
      skillsToUse: [],
      isComplex: false,
      plan: undefined,
      iterationCount: 0,
      isFailing: false,
      maxIterations: 10,
      lastToolCallSignature: undefined,
      taskStatus: undefined,
      finalResponse: undefined,
      currentTeamId: undefined,
      requestId,
      delegationDepth: 0,
    });
  } catch (error) {
    console.warn(`⚠️ No se pudo invocar al equipo ${teamId}:`, error);
    return {
      role: 'assistant',
      content: 'No pude encontrar ese equipo. Puede que se haya borrado — revisá la pestaña de Equipos.',
    };
  }
}

/**
 * Live-status amendment — `.stream()` in 'updates' mode yields
 * `{ [nodeName]: partialStateUpdate }` per completed node, which is all we
 * need to report progress; only `finalizeResponse`'s own update ever sets
 * `finalResponse`, so that's the one we pull the actual reply from.
 */
async function runRootGraphWithStatus(
  graph: ReturnType<typeof buildReasoningGraph>,
  messages: LlmMessage[],
  requestId?: string,
): Promise<LlmMessage> {
  let finalResponse: LlmMessage | undefined;
  const stream = await graph.stream(
    { messages, iterationCount: 0, isFailing: false, maxIterations: 10, requestId },
    { streamMode: 'updates' },
  );
  for await (const chunk of stream) {
    for (const [nodeName, update] of Object.entries(chunk as Record<string, Partial<PipelineState> | undefined>)) {
      if (requestId) {
        const label = labelForNode(nodeName);
        if (label) {
          setInquireStatus(requestId, label);
        }
      }
      if (nodeName === 'finalizeResponse' && update?.finalResponse) {
        finalResponse = update.finalResponse;
      }
    }
  }
  return finalResponse ?? { role: 'assistant', content: null };
}

export async function runReasoningGraph(
  messages: LlmMessage[],
  options?: { teamId?: string; requestId?: string },
): Promise<LlmMessage> {
  await initializeGraphRuntime();

  if (!mcpManager || !mcpManager.hasTools()) {
    // Same rare-edge-case fallback the old Orchestrator used when MCP
    // couldn't be reached at all — not a per-node concern, one early exit.
    console.warn('⚠️ No hay servidores MCP disponibles.');
    return {
      role: 'assistant',
      content:
        'En este momento no tengo acceso a las herramientas de análisis. Por favor, verifica que los servidores MCP estén configurados y activos e intenta de nuevo.',
    };
  }

  // orchestrator/002-multi-agent AC2 / knowledge-store/005-skills / orchestrator/003-teams:
  // zero Agent/Team/Skill rows configured means an empty list here,
  // toolHandlesFor(null)/teamHandlesFor(null) return [], skillManager.list()
  // returns [], and the graph below is byte-for-byte what
  // 001-reasoning-pipeline builds on its own.
  const [agentSummaries, teamSummaries, skillSummaries, vaultFolders] = await Promise.all([
    knowledgeStoreClient.listAgents(),
    knowledgeStoreClient.listTeams(),
    knowledgeStoreClient.listSkills(),
    knowledgeStoreClient.listVaultFolders(),
  ]);

  const agentConfigs: AgentConfig[] = agentSummaries.map((a) => ({
    id: a.id,
    name: a.name,
    systemPromptAddendum: a.systemPromptAddendum,
    allowedTools: a.allowedTools,
    allowedSkills: a.allowedSkills,
    pipelineSteps: a.pipelineSteps,
  }));
  const teamConfigs: TeamConfig[] = teamSummaries.map((t) => ({
    id: t.id,
    name: t.name,
    memberAgentIds: t.memberAgentIds,
    coordinatorAgentId: t.coordinatorAgentId,
    hierarchy: t.hierarchy,
    projectSummaries: resolveProjectSummaries(t.projectFolderIds, vaultFolders),
    allowedSkillIds: t.allowedSkillIds,
  }));
  const skillManager = new SkillManager(skillSummaries);

  const baseTools = mcpManager.getAllTools();
  const agentRegistry = new AgentRegistry(agentConfigs, teamConfigs, {
    mcpManager,
    llmProvider,
    smallLlmProvider,
    skillRouter,
    reranker,
    skillManager,
    tools: baseTools,
    knowledgeStoreClient,
  });

  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  // orchestrator/003-teams team-chat amendment — a session started from the
  // Teams tab's "Chatear con este equipo" carries a teamId and dispatches
  // straight to that team's coordinator, skipping the root graph's own
  // tool/skill selection entirely: the whole point of a dedicated team
  // chat is that the team decides what to do with the message, not the
  // general assistant.
  if (options?.teamId) {
    return invokeTeamChat(agentRegistry, options.teamId, nonSystemMessages, options.requestId);
  }

  const graph = buildReasoningGraph({
    mcpManager,
    llmProvider,
    smallLlmProvider,
    skillRouter,
    reranker,
    skillManager,
    // AC4 (002) — the default/no-agent conversation's LLM also sees a
    // delegation handle for every configured agent and team (fromAgentId/
    // fromTeamId: null excludes none).
    tools: [...baseTools, ...agentRegistry.toolHandlesFor(null), ...agentRegistry.teamHandlesFor(null)],
    agentRegistry,
    knowledgeStoreClient,
  });

  return runRootGraphWithStatus(graph, nonSystemMessages, options?.requestId);
}

export async function disconnectGraphRuntime(): Promise<void> {
  if (mcpManager) {
    await mcpManager.disconnectAll();
  }
  initPromise = null;
  mcpManager = null;
}
