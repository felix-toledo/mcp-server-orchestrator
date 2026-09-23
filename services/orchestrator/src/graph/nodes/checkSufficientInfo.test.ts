import { describe, expect, it } from 'vitest';
import { checkSufficientInfo } from './checkSufficientInfo.js';
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

describe('checkSufficientInfo', () => {
  it('AC4: true when the reranked set is non-empty', () => {
    expect(
      checkSufficientInfo(state({ rerankedTop5: [{ id: 'k1', path: 'a.md', title: 'A', summary: 's', similarity: 0.9, type: 'entry', score: 0.9 }] })),
    ).toEqual({ hasSufficientInfo: true });
  });

  it('AC4: false when the reranked set is empty', () => {
    expect(checkSufficientInfo(state({ rerankedTop5: [] }))).toEqual({ hasSufficientInfo: false });
  });
});
