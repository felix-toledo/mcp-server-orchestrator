import { describe, expect, it, vi } from 'vitest';
import type { PipelineState } from '../graph/state.js';
import { buildPipelineAgentGraph } from './buildPipelineAgentGraph.js';

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
    iterationCount: 3,
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

describe('buildPipelineAgentGraph (AC5)', () => {
  it('invokes each step in order and returns the last step response as finalResponse', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ role: 'assistant', content: 'paso 1' })
      .mockResolvedValueOnce({ role: 'assistant', content: 'paso 2' });

    const graph = buildPipelineAgentGraph(['s1', 's2'], { isAgentHandle: () => false, invoke });
    const result = await graph.invoke(state());

    expect(invoke.mock.calls[0][0]).toBe('s1');
    expect(invoke.mock.calls[1][0]).toBe('s2');
    expect(result.finalResponse).toEqual({ role: 'assistant', content: 'paso 2' });
  });

  it('each step sees the previous steps replies appended to messages', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ role: 'assistant', content: 'paso 1' })
      .mockResolvedValueOnce({ role: 'assistant', content: 'paso 2' });

    const graph = buildPipelineAgentGraph(['s1', 's2'], { isAgentHandle: () => false, invoke });
    await graph.invoke(state());

    const secondCallState = invoke.mock.calls[1][1] as PipelineState;
    expect(secondCallState.messages.some((m) => m.content === 'paso 1')).toBe(true);
  });

  it('AC6: does not reset the shared iteration counter passed in by the caller', async () => {
    const invoke = vi.fn().mockResolvedValue({ role: 'assistant', content: 'ok' });
    const graph = buildPipelineAgentGraph(['s1'], { isAgentHandle: () => false, invoke });

    await graph.invoke(state({ iterationCount: 7, maxIterations: 10 }));

    const callState = invoke.mock.calls[0][1] as PipelineState;
    expect(callState.iterationCount).toBe(7);
    expect(callState.maxIterations).toBe(10);
  });
});
