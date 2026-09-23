import { describe, expect, it, vi } from 'vitest';
import type { ILlmProvider } from '../../llm/ILlmProvider.js';
import { createMakePlanNode } from './makePlan.js';
import type { PipelineState } from '../state.js';

function state(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    messages: [{ role: 'user', content: 'organizá mi semana' }],
    ragTop20: [],
    rerankedTop5: [],
    profileNote: null,
    hasSufficientInfo: false,
    skillsToUse: [],
    isComplex: true,
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

describe('createMakePlanNode', () => {
  it('AC5: returns the plan text from the LLM', async () => {
    const llmProvider: ILlmProvider = {
      generateResponse: vi.fn().mockResolvedValue({ content: '1. Paso uno\n2. Paso dos', finishReason: 'stop', assistantMessage: { role: 'assistant', content: '1. Paso uno\n2. Paso dos' } }),
      getName: () => 'fake',
    };
    const node = createMakePlanNode({ llmProvider });

    const result = await node(state());

    expect(result.plan).toContain('Paso uno');
  });

  it('degrades to no plan when the LLM call fails', async () => {
    const llmProvider: ILlmProvider = {
      generateResponse: vi.fn().mockRejectedValue(new Error('down')),
      getName: () => 'fake',
    };
    const node = createMakePlanNode({ llmProvider });

    await expect(node(state())).resolves.toEqual({ plan: undefined });
  });

  it('skips the call when there is no user message', async () => {
    const generateResponse = vi.fn();
    const node = createMakePlanNode({ llmProvider: { generateResponse, getName: () => 'fake' } });

    await node(state({ messages: [] }));

    expect(generateResponse).not.toHaveBeenCalled();
  });
});
