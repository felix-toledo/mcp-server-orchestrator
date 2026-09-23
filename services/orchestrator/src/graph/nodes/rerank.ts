import type { Reranker } from '../../retrieval/Reranker.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

const RERANK_TOP_K = 5;

/** AC3 — narrows ragTop20 to the top 5 by cross-encoder relevance. */
export function createRerankNode(deps: { reranker: Reranker }) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage?.content || state.ragTop20.length === 0) {
      return { rerankedTop5: [] };
    }

    try {
      const reranked = await deps.reranker.rerank(lastUserMessage.content, state.ragTop20, RERANK_TOP_K);
      return { rerankedTop5: reranked };
    } catch (error) {
      console.warn('⚠️ Reranker falló, sigo sin resultados rerankeados:', error);
      return { rerankedTop5: [] };
    }
  };
}
