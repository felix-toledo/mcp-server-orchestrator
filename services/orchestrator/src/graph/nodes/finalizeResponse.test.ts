import { describe, expect, it } from 'vitest';
import { finalizeResponse } from './finalizeResponse.js';
import type { LlmMessage } from '../../llm/ILlmProvider.js';
import type { PipelineState } from '../state.js';

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

describe('finalizeResponse', () => {
  it('AC9: returns the last assistant message when the task is genuinely done', () => {
    const result = finalizeResponse(
      state({ messages: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'respuesta final' }] }),
    );
    expect(result.finalResponse).toEqual({ role: 'assistant', content: 'respuesta final' });
  });

  it('AC8: returns the graceful iteration-limit message when the budget is exhausted', () => {
    const result = finalizeResponse(state({ iterationCount: 5, maxIterations: 5 }));
    expect((result.finalResponse as LlmMessage | undefined)?.content).toMatch(/límite de iteraciones/);
  });
});
