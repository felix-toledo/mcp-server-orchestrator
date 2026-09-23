import type { KnowledgeStoreClient } from '../../knowledge/knowledgeStoreClient.js';
import type { PipelineStateUpdate } from '../state.js';

/**
 * 2026-09-18 addendum — always fetches the running "Perfil" note by its
 * well-known path, never via similarity search: verified live that neither
 * the embedding search nor the cross-encoder reranker recognizes a broad
 * query ("¿qué sabés de mí?") as relevant to any note, including this one.
 * Runs in the same parallel fan-out as fetchRagTop20/runSkillRouter — see
 * `noop`'s comment in buildReasoningGraph.ts for why it needs its own
 * `awaitProfileNote` hop to stay at equal depth with the other branches.
 * Never throws — `KnowledgeStoreClient.getProfileNote` already fails open.
 */
export function createFetchProfileNoteNode(deps: {
  knowledgeStoreClient: Pick<KnowledgeStoreClient, 'getProfileNote'>;
}) {
  return async (): Promise<PipelineStateUpdate> => {
    const note = await deps.knowledgeStoreClient.getProfileNote();
    return { profileNote: note?.content ?? null };
  };
}
