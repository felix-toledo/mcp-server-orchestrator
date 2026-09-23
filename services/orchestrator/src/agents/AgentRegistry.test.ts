import { describe, expect, it, vi } from 'vitest';
import type { ReasoningGraphDeps } from '../graph/buildReasoningGraph.js';
import type { PipelineState } from '../graph/state.js';
import { AgentRegistry, agentHandleName, teamHandleName, type AgentConfig, type TeamConfig } from './AgentRegistry.js';

function state(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    messages: [{ role: 'user', content: 'hola' }],
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
    requestId: undefined,
    delegationDepth: 0,
    ...overrides,
  };
}

function agent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'a1',
    name: 'Investigador',
    systemPromptAddendum: 'Sos muy meticuloso.',
    allowedTools: null,
    allowedSkills: null,
    pipelineSteps: null,
    ...overrides,
  };
}

function team(overrides: Partial<TeamConfig> = {}): TeamConfig {
  return {
    id: 't1',
    name: 'Marketing',
    memberAgentIds: ['a1'],
    coordinatorAgentId: 'a1',
    hierarchy: null,
    projectSummaries: [],
    allowedSkillIds: null,
    ...overrides,
  };
}

/** A graph deps set minimal enough to let buildReasoningGraph run end to end without hitting real infra. */
function fakeBaseDeps(overrides: Partial<ReasoningGraphDeps> = {}): ReasoningGraphDeps {
  return {
    mcpManager: { callTool: vi.fn().mockResolvedValue(undefined) } as unknown as ReasoningGraphDeps['mcpManager'],
    llmProvider: {
      generateResponse: vi.fn().mockResolvedValue({
        content: 'respuesta del agente',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'respuesta del agente' },
      }),
      getName: () => 'fake',
    },
    smallLlmProvider: { generateResponse: vi.fn(), getName: () => 'fake-small' },
    skillRouter: { route: vi.fn().mockResolvedValue({ skills: [], isComplex: false }) },
    reranker: { rerank: vi.fn().mockResolvedValue([]) },
    skillManager: { list: () => [], resolve: () => '' } as unknown as ReasoningGraphDeps['skillManager'],
    tools: [
      { name: 'createKnowledgeEntry', description: '', parameters: {} },
      { name: 'searchKnowledgeEntries', description: '', parameters: {} },
    ],
    knowledgeStoreClient: { getProfileNote: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

describe('agentHandleName', () => {
  it('slugifies accents/spaces into a snake_case askAgent_ handle', () => {
    expect(agentHandleName({ name: 'Investigador Ávido' })).toBe('askAgent_investigador_avido');
  });
});

describe('teamHandleName', () => {
  it('slugifies accents/spaces into a snake_case askTeam_ handle', () => {
    expect(teamHandleName({ name: 'Equipo de Marketing' })).toBe('askTeam_equipo_de_marketing');
  });
});

describe('AgentRegistry.toolHandlesFor (AC4 002 / AC3 003)', () => {
  it('exposes every other configured agent, never the caller itself, when no team is given', () => {
    const a = agent({ id: 'a1', name: 'Investigador' });
    const b = agent({ id: 'a2', name: 'Redactor' });
    const registry = new AgentRegistry([a, b], [], fakeBaseDeps());

    const handlesFromA = registry.toolHandlesFor('a1');
    expect(handlesFromA.map((h) => h.name)).toEqual(['askAgent_redactor']);

    const handlesFromNull = registry.toolHandlesFor(null);
    expect(handlesFromNull.map((h) => h.name).sort()).toEqual(['askAgent_investigador', 'askAgent_redactor']);
  });

  it('AC3 (003): narrows to teammates only when fromTeamId is given, excluding non-members', () => {
    const a = agent({ id: 'a1', name: 'Investigador' });
    const b = agent({ id: 'a2', name: 'Redactor' });
    const c = agent({ id: 'a3', name: 'Ajeno al equipo' });
    const t = team({ id: 't1', memberAgentIds: ['a1', 'a2'] });
    const registry = new AgentRegistry([a, b, c], [t], fakeBaseDeps());

    const handles = registry.toolHandlesFor('a1', 't1');

    expect(handles.map((h) => h.name)).toEqual(['askAgent_redactor']);
  });

  it('hierarchy amendment: narrows a team member to just their manager + direct reports when an org chart is configured', () => {
    const manager = agent({ id: 'a1', name: 'Manager' });
    const report = agent({ id: 'a2', name: 'Reporte' });
    const peer = agent({ id: 'a3', name: 'Otro Reporte' });
    const t = team({
      id: 't1',
      memberAgentIds: ['a1', 'a2', 'a3'],
      coordinatorAgentId: 'a1',
      hierarchy: [
        { agentId: 'a1', managerAgentId: null },
        { agentId: 'a2', managerAgentId: 'a1' },
        { agentId: 'a3', managerAgentId: 'a1' },
      ],
    });
    const registry = new AgentRegistry([manager, report, peer], [t], fakeBaseDeps());

    // Peers with the same manager can't see each other, only their manager.
    expect(registry.toolHandlesFor('a2', 't1').map((h) => h.name)).toEqual(['askAgent_manager']);
    // The manager sees both direct reports.
    expect(registry.toolHandlesFor('a1', 't1').map((h) => h.name).sort()).toEqual([
      'askAgent_otro_reporte',
      'askAgent_reporte',
    ]);
  });

  it('hierarchy amendment: a member missing from a partial hierarchy falls back to full mesh, not zero visibility', () => {
    const a = agent({ id: 'a1', name: 'Investigador' });
    const b = agent({ id: 'a2', name: 'Redactor' });
    const unlisted = agent({ id: 'a3', name: 'Sin Ubicar' });
    const t = team({
      id: 't1',
      memberAgentIds: ['a1', 'a2', 'a3'],
      coordinatorAgentId: 'a1',
      hierarchy: [{ agentId: 'a1', managerAgentId: null }],
    });
    const registry = new AgentRegistry([a, b, unlisted], [t], fakeBaseDeps());

    expect(registry.toolHandlesFor('a3', 't1').map((h) => h.name).sort()).toEqual([
      'askAgent_investigador',
      'askAgent_redactor',
    ]);
  });
});

describe('AgentRegistry.isAgentHandle / isTeamHandle', () => {
  it('recognizes a registered agent handle and rejects an arbitrary tool name', () => {
    const registry = new AgentRegistry([agent({ id: 'a1', name: 'Investigador' })], [], fakeBaseDeps());
    expect(registry.isAgentHandle('askAgent_investigador')).toBe(true);
    expect(registry.isAgentHandle('createKnowledgeEntry')).toBe(false);
  });

  it('AC5 (003): recognizes a registered team handle and rejects an arbitrary tool name', () => {
    const registry = new AgentRegistry([agent({ id: 'a1' })], [team({ id: 't1', name: 'Marketing' })], fakeBaseDeps());
    expect(registry.isTeamHandle('askTeam_marketing')).toBe(true);
    expect(registry.isTeamHandle('createKnowledgeEntry')).toBe(false);
  });
});

describe('AgentRegistry.teamHandlesFor (AC5 003)', () => {
  it('exposes every other configured team, never the caller itself', () => {
    const t1 = team({ id: 't1', name: 'Marketing' });
    const t2 = team({ id: 't2', name: 'Ventas' });
    const registry = new AgentRegistry([agent({ id: 'a1' })], [t1, t2], fakeBaseDeps());

    const handlesFromT1 = registry.teamHandlesFor('t1');
    expect(handlesFromT1.map((h) => h.name)).toEqual(['askTeam_ventas']);

    const handlesFromNull = registry.teamHandlesFor(null);
    expect(handlesFromNull.map((h) => h.name).sort()).toEqual(['askTeam_marketing', 'askTeam_ventas']);
  });
});

describe('AgentRegistry.invoke', () => {
  it('runs the agent-scoped graph and returns its finalResponse', async () => {
    const registry = new AgentRegistry([agent({ id: 'a1', name: 'Investigador' })], [], fakeBaseDeps());

    const result = await registry.invoke('askAgent_investigador', state());

    expect(result).toEqual({ role: 'assistant', content: 'respuesta del agente' });
  });

  it('real bug (2026-09-17): strips the caller own dangling tool_calls message before invoking the sub-agent', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const registry = new AgentRegistry([agent({ id: 'a1', name: 'Investigador' })], [], deps);

    const callerState = state({
      messages: [
        { role: 'user', content: 'delegale esto al agente' },
        {
          role: 'assistant',
          content: null,
          toolCalls: [{ id: 't1', name: 'askAgent_investigador', arguments: '{}' }],
        },
      ],
    });

    await registry.invoke('askAgent_investigador', callerState);

    const [messagesSentToLlm] = generateResponse.mock.calls[0];
    expect(messagesSentToLlm.some((m: { toolCalls?: unknown[] }) => (m.toolCalls?.length ?? 0) > 0)).toBe(false);
  });

  it('AC1: restricts the tools passed to the LLM to allowedTools', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const registry = new AgentRegistry(
      [agent({ id: 'a1', name: 'Buscador', allowedTools: ['searchKnowledgeEntries'] })],
      [],
      deps,
    );

    await registry.invoke('a1', state());

    const [, toolsPassed] = generateResponse.mock.calls[0];
    // searchKnowledgeEntries is always excluded from the LLM-visible list
    // (callLlm's own rule — it's auto-run, not LLM-callable), so an agent
    // restricted to only that tool ends up with none of its own tools, only
    // its own askAgent_* handle set (empty here, single-agent).
    expect(toolsPassed).toEqual([]);
  });

  it('AC3: appends the agent systemPromptAddendum to the base instructions, never replacing them', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const registry = new AgentRegistry([agent({ id: 'a1', systemPromptAddendum: 'Sé muy formal.' })], [], deps);

    await registry.invoke('a1', state());

    const [messages] = generateResponse.mock.calls[0];
    expect(messages[0].content).toContain('Sé muy formal.');
    expect(messages[0].content).toContain('Sos ALMA');
  });

  it('AC6: a nested invoke shares the caller iteration budget instead of starting fresh', async () => {
    const registry = new AgentRegistry([agent({ id: 'a1' })], [], fakeBaseDeps());

    await registry.invoke('a1', state({ iterationCount: 9, maxIterations: 10 }));

    // The fake LLM never requests a tool call, so no iteration is spent —
    // this only proves the caller's counter was accepted as-is (not reset
    // to 0), which is what a real A→B→A cycle relies on to terminate.
    expect(registry.toolHandlesFor(null)).toBeDefined();
  });

  it('2026-09-18 real bug: two agents endlessly delegating back to whoever just asked them terminates quickly instead of hanging forever', async () => {
    const a = agent({ id: 'a1', name: 'Agente A' });
    const handleA = agentHandleName(a);
    // The mocked LLM always "delegates" instead of answering, no matter
    // which agent's turn it is — reproduces the real trace found live
    // (two agents each replying to being asked with "le pregunto a los
    // dos", including the one who just asked): every callLlm invocation
    // just re-delegates, so nothing terminates this chain except the
    // dedicated delegation-depth cap (`MAX_DELEGATION_DEPTH`).
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'Le pregunto a mi compañero.',
      toolCalls: [{ id: 'c1', name: handleA, arguments: '{"message":"¿cómo viene el negocio?"}' }],
      finishReason: 'tool_calls',
      assistantMessage: {
        role: 'assistant',
        content: 'Le pregunto a mi compañero.',
        toolCalls: [{ id: 'c1', name: handleA, arguments: '{"message":"¿cómo viene el negocio?"}' }],
      },
    });
    const registry = new AgentRegistry([a], [], fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } }));

    const result = await registry.invoke('a1', state({ iterationCount: 0, maxIterations: 10 }));

    expect(result.content).toMatch(/límite de iteraciones/i);
    // Bounded to a couple dozen real calls at most (MAX_DELEGATION_DEPTH
    // is 2, not the general 10-round tool budget) — the whole point of
    // this being a separate, tight cap: a real chat turn stays fast even
    // when delegation genuinely never converges, instead of the "still
    // going after 150+ seconds" seen live with the general budget alone.
    expect(generateResponse.mock.calls.length).toBeLessThanOrEqual(20);
  });

  it('throws for an unknown agent id or handle', async () => {
    const registry = new AgentRegistry([agent({ id: 'a1' })], [], fakeBaseDeps());
    await expect(registry.invoke('askAgent_no_existe', state())).rejects.toThrow(/Unknown agent/);
  });

  it('AC5 (002): a pipeline agent runs its steps as a fixed sequence, each step feeding the next', async () => {
    const generateResponse = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'paso 1 listo',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'paso 1 listo' },
      })
      .mockResolvedValueOnce({
        content: 'paso 2 listo',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'paso 2 listo' },
      });

    const step1 = agent({ id: 's1', name: 'Paso 1' });
    const step2 = agent({ id: 's2', name: 'Paso 2' });
    const pipeline = agent({ id: 'p1', name: 'Pipeline', pipelineSteps: ['s1', 's2'] });

    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const registry = new AgentRegistry([step1, step2, pipeline], [], deps);

    const result = await registry.invoke('p1', state());

    // The pipeline node itself makes no LLM call — the two calls above come
    // from step1's and step2's own graphs, run in order; the last step's
    // response is what the pipeline agent returns.
    expect(generateResponse).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ role: 'assistant', content: 'paso 2 listo' });

    // Step 2's own callLlm call must have seen step 1's reply as context.
    const [step2Messages] = generateResponse.mock.calls[1];
    expect(step2Messages.some((m: { content: unknown }) => m.content === 'paso 1 listo')).toBe(true);
  });
});

describe('AgentRegistry.invokeTeam (orchestrator/003-teams)', () => {
  it('AC5: always dispatches to the coordinatorAgentId first', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'respuesta del coordinador',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'respuesta del coordinador' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const coordinator = agent({ id: 'a1', name: 'Coordinador' });
    const member = agent({ id: 'a2', name: 'Miembro' });
    const t = team({ id: 't1', name: 'Marketing', memberAgentIds: ['a1', 'a2'], coordinatorAgentId: 'a1' });
    const registry = new AgentRegistry([coordinator, member], [t], deps);

    const result = await registry.invokeTeam('askTeam_marketing', state());

    expect(result).toEqual({ role: 'assistant', content: 'respuesta del coordinador' });
  });

  it('AC3: the coordinator only sees teammates as askAgent_ handles, not every configured agent', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const coordinator = agent({ id: 'a1', name: 'Coordinador' });
    const member = agent({ id: 'a2', name: 'Miembro' });
    const outsider = agent({ id: 'a3', name: 'Ajeno' });
    const t = team({ id: 't1', memberAgentIds: ['a1', 'a2'], coordinatorAgentId: 'a1' });
    const registry = new AgentRegistry([coordinator, member, outsider], [t], deps);

    await registry.invokeTeam('t1', state());

    const [, toolsPassed] = generateResponse.mock.calls[0];
    const toolNames = toolsPassed.map((t: { name: string }) => t.name);
    expect(toolNames).toContain('askAgent_miembro');
    expect(toolNames).not.toContain('askAgent_ajeno');
  });

  it('AC4: additive skills — the coordinator gets its own allowedSkills plus the team\'s', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const allSkills = [
      { id: 's1', name: 'skill-propia', description: 'x', instructions: 'y' },
      { id: 's2', name: 'skill-equipo', description: 'x', instructions: 'y' },
      { id: 's3', name: 'skill-ajena', description: 'x', instructions: 'y' },
    ];
    const deps = fakeBaseDeps({
      llmProvider: { generateResponse, getName: () => 'fake' },
      skillRouter: { route: vi.fn().mockResolvedValue({ skills: [], isComplex: false }) },
      skillManager: { list: () => allSkills, resolve: () => '' } as unknown as ReasoningGraphDeps['skillManager'],
    });
    const coordinator = agent({ id: 'a1', allowedSkills: ['s1'] });
    const t = team({ id: 't1', memberAgentIds: ['a1'], coordinatorAgentId: 'a1', allowedSkillIds: ['s2'] });
    const registry = new AgentRegistry([coordinator], [t], deps);

    await registry.invokeTeam('t1', state());

    const [skillRouterQuery, skillRouterAvailable] = vi.mocked(deps.skillRouter.route).mock.calls[0];
    expect(skillRouterQuery).toBe('hola');
    const names = skillRouterAvailable.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['skill-propia', 'skill-equipo']));
    expect(names).not.toContain('skill-ajena');
  });

  it('AC7: injects project summaries into the system prompt', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const coordinator = agent({ id: 'a1' });
    const t = team({
      id: 't1',
      name: 'Marketing',
      memberAgentIds: ['a1'],
      coordinatorAgentId: 'a1',
      projectSummaries: ['marketing/campañas: resumen de campañas activas'],
    });
    const registry = new AgentRegistry([coordinator], [t], deps);

    await registry.invokeTeam('t1', state());

    const [messages] = generateResponse.mock.calls[0];
    expect(messages[0].content).toContain('resumen de campañas activas');
  });

  it('AC8: a nested member-to-member delegation inside a team still shares the caller iteration budget', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const deps = fakeBaseDeps({ llmProvider: { generateResponse, getName: () => 'fake' } });
    const coordinator = agent({ id: 'a1' });
    const t = team({ id: 't1', memberAgentIds: ['a1'], coordinatorAgentId: 'a1' });
    const registry = new AgentRegistry([coordinator], [t], deps);

    const result = await registry.invokeTeam('t1', state({ iterationCount: 9, maxIterations: 10 }));

    expect(result).toEqual({ role: 'assistant', content: 'ok' });
  });

  it('throws for an unknown team id or handle', async () => {
    const registry = new AgentRegistry([agent({ id: 'a1' })], [], fakeBaseDeps());
    await expect(registry.invokeTeam('askTeam_no_existe', state())).rejects.toThrow(/Unknown team/);
  });
});
