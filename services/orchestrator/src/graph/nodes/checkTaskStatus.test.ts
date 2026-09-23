import { describe, expect, it } from 'vitest';
import { checkTaskStatus } from './checkTaskStatus.js';
import type { LlmMessage } from '../../llm/ILlmProvider.js';
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

describe('checkTaskStatus', () => {
  it('AC9: simple tasks are always DONE, no marker needed', () => {
    expect(checkTaskStatus(state({ isComplex: false }))).toEqual({ taskStatus: 'DONE' });
  });

  it('AC9: a complex task with an IN_PROGRESS marker stays in progress, and the marker is stripped', () => {
    const result = checkTaskStatus(
      state({
        isComplex: true,
        messages: [{ role: 'assistant', content: 'Terminé el paso 1.\n[STATUS: IN_PROGRESS]' }],
      }),
    );
    expect(result.taskStatus).toBe('IN_PROGRESS');
    expect(messagesOf(result)[0].content).toBe('Terminé el paso 1.');
  });

  it('AC9: a complex task with a DONE marker is finished, and the marker is stripped', () => {
    const result = checkTaskStatus(
      state({ isComplex: true, messages: [{ role: 'assistant', content: 'Listo.\n[STATUS: DONE]' }] }),
    );
    expect(result.taskStatus).toBe('DONE');
    expect(messagesOf(result)[0].content).toBe('Listo.');
  });

  it('AC9: a complex task with no marker at all defaults to DONE and leaves messages untouched', () => {
    const result = checkTaskStatus(
      state({ isComplex: true, messages: [{ role: 'assistant', content: 'Listo, sin marcador.' }] }),
    );
    expect(result).toEqual({ taskStatus: 'DONE' });
  });

  it('2026-09-18 fix: an IN_PROGRESS verdict spends from the shared iteration budget', () => {
    const result = checkTaskStatus(
      state({
        isComplex: true,
        iterationCount: 2,
        messages: [{ role: 'assistant', content: 'Voy a consultarles a los dos.\n[STATUS: IN_PROGRESS]' }],
      }),
    );
    expect(result.iterationCount).toBe(3);
  });

  it('2026-09-18 fix: a DONE verdict never touches iterationCount', () => {
    const result = checkTaskStatus(
      state({ isComplex: true, iterationCount: 2, messages: [{ role: 'assistant', content: 'Listo.\n[STATUS: DONE]' }] }),
    );
    expect(result.iterationCount).toBeUndefined();
  });

  it('only touches the most recent assistant message, not earlier ones', () => {
    const result = checkTaskStatus(
      state({
        isComplex: true,
        messages: [
          { role: 'assistant', content: 'Primera respuesta [STATUS: DONE] (no debería tocarse)' },
          { role: 'user', content: 'seguí' },
          { role: 'assistant', content: 'Segunda respuesta\n[STATUS: IN_PROGRESS]' },
        ],
      }),
    );
    expect(result.taskStatus).toBe('IN_PROGRESS');
    expect(messagesOf(result)[0].content).toBe('Primera respuesta [STATUS: DONE] (no debería tocarse)');
    expect(messagesOf(result)[2].content).toBe('Segunda respuesta');
  });
});
