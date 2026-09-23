import type { PipelineState, PipelineStateUpdate } from '../state.js';

/** Exported so `AgentRegistry.invoke`'s own upfront budget check (2026-09-18) returns the exact same wording, not a second copy. */
export const ITERATION_LIMIT_MESSAGE =
  'He alcanzado el límite de iteraciones. Por favor, reformula tu pregunta o divide la tarea en pasos más pequeños.';

/** AC8 (iteration limit hit) / AC9 (task genuinely done) — produces the turn's final response. */
export function finalizeResponse(state: PipelineState): PipelineStateUpdate {
  if (state.iterationCount >= state.maxIterations) {
    console.warn(`⚠️ Se alcanzó el límite de iteraciones (${state.maxIterations})`);
    return { finalResponse: { role: 'assistant', content: ITERATION_LIMIT_MESSAGE } };
  }

  const lastAssistant = [...state.messages].reverse().find((m) => m.role === 'assistant');
  return { finalResponse: lastAssistant ?? { role: 'assistant', content: null } };
}
