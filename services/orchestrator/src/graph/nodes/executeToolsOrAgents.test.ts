import { describe, expect, it, vi } from 'vitest';
import type { LlmMessage } from '../../llm/ILlmProvider.js';
import type { McpManager } from '../../mcp/McpManager.js';
import { createExecuteToolsOrAgentsNode } from './executeToolsOrAgents.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

function messagesOf(update: PipelineStateUpdate): LlmMessage[] {
  return update.messages as LlmMessage[];
}

function state(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    messages: [],
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

function fakeMcpManager(callTool = vi.fn()): McpManager {
  return { callTool } as unknown as McpManager;
}

describe('createExecuteToolsOrAgentsNode', () => {
  it('returns an empty update when the last message has no tool calls', async () => {
    const node = createExecuteToolsOrAgentsNode({ mcpManager: fakeMcpManager() });
    const result = await node(state({ messages: [{ role: 'assistant', content: 'ok' }] }));
    expect(result).toEqual({});
  });

  it('AC7: executes a requested tool call and appends the result', async () => {
    const callTool = vi.fn().mockResolvedValue({ ok: true });
    const node = createExecuteToolsOrAgentsNode({ mcpManager: fakeMcpManager(callTool) });

    const result = await node(
      state({
        messages: [{ role: 'assistant', content: null, toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{"title":"x"}' }] }],
      }),
    );

    expect(callTool).toHaveBeenCalledWith('createKnowledgeEntry', { title: 'x' });
    expect(messagesOf(result).at(-1)).toMatchObject({ role: 'tool', name: 'createKnowledgeEntry' });
    expect(result.iterationCount).toBe(1);
    expect(result.isFailing).toBe(false);
    expect(result.maxIterations).toBe(10);
  });

  it('AC8: a tool error sets isFailing and drops the budget to 5', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('boom'));
    const node = createExecuteToolsOrAgentsNode({ mcpManager: fakeMcpManager(callTool) });

    const result = await node(
      state({
        messages: [{ role: 'assistant', content: null, toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{}' }] }],
      }),
    );

    expect(result.isFailing).toBe(true);
    expect(result.maxIterations).toBe(5);
    const toolMessage = messagesOf(result).at(-1);
    expect(JSON.parse(toolMessage!.content as string)).toEqual({ error: 'boom' });
  });

  it('AC8: an exact-repeat tool call (same name + arguments) sets isFailing', async () => {
    const callTool = vi.fn().mockResolvedValue({ ok: true });
    const node = createExecuteToolsOrAgentsNode({ mcpManager: fakeMcpManager(callTool) });

    const result = await node(
      state({
        lastToolCallSignature: 'createKnowledgeEntry:{"title":"x"}',
        messages: [{ role: 'assistant', content: null, toolCalls: [{ id: 't2', name: 'createKnowledgeEntry', arguments: '{"title":"x"}' }] }],
      }),
    );

    expect(result.isFailing).toBe(true);
    expect(result.maxIterations).toBe(5);
  });

  it('routes to the agent registry when the tool name is a registered agent handle', async () => {
    const callTool = vi.fn();
    const invoke = vi.fn().mockResolvedValue({ role: 'assistant', content: 'respuesta del sub-agente' });
    const node = createExecuteToolsOrAgentsNode({
      mcpManager: fakeMcpManager(callTool),
      agentRegistry: { isAgentHandle: (name) => name === 'askAgent_investigador', invoke },
    });

    const result = await node(
      state({
        messages: [{ role: 'assistant', content: null, toolCalls: [{ id: 't1', name: 'askAgent_investigador', arguments: '{}' }] }],
      }),
    );

    expect(invoke).toHaveBeenCalled();
    expect(callTool).not.toHaveBeenCalled();
    expect(JSON.parse(messagesOf(result).at(-1)!.content as string)).toEqual({
      role: 'assistant',
      content: 'respuesta del sub-agente',
    });
  });
});
