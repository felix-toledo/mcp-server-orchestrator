import type { PipelineState, PipelineStateUpdate } from '../state.js';

/** AC4 — "¿tenemos información?" is true iff the reranked set is non-empty. */
export function checkSufficientInfo(state: PipelineState): PipelineStateUpdate {
  return { hasSufficientInfo: state.rerankedTop5.length > 0 };
}
