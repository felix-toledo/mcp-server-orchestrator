import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchKnowledgeEntriesResult } from '../mcp/searchKnowledgeEntriesResult.js';

const { fromPretrainedTokenizerMock, fromPretrainedModelMock, tokenizerMock, modelMock } = vi.hoisted(() => {
  const tokenizerMock = vi.fn();
  const modelMock = vi.fn();
  return {
    fromPretrainedTokenizerMock: vi.fn().mockResolvedValue(tokenizerMock),
    fromPretrainedModelMock: vi.fn().mockResolvedValue(modelMock),
    tokenizerMock,
    modelMock,
  };
});

vi.mock('@huggingface/transformers', () => ({
  AutoTokenizer: { from_pretrained: fromPretrainedTokenizerMock },
  AutoModelForSequenceClassification: { from_pretrained: fromPretrainedModelMock },
}));

import { TransformersJsReranker } from './Reranker.js';

function candidate(overrides: Partial<SearchKnowledgeEntriesResult> = {}): SearchKnowledgeEntriesResult {
  return { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen', similarity: 0.5, type: 'entry', ...overrides };
}

describe('TransformersJsReranker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenizerMock.mockReturnValue({ input_ids: [] });
    fromPretrainedTokenizerMock.mockResolvedValue(tokenizerMock);
    fromPretrainedModelMock.mockResolvedValue(modelMock);
  });

  it('returns [] immediately for an empty candidate list, without loading the model', async () => {
    const reranker = new TransformersJsReranker();
    await expect(reranker.rerank('query', [], 5)).resolves.toEqual([]);
    expect(fromPretrainedModelMock).not.toHaveBeenCalled();
  });

  it('scores via sigmoid(raw logit), sorts descending, drops below the minimum bar (AC3)', async () => {
    // logits: relevant candidate high, irrelevant one very negative → filtered out
    modelMock
      .mockResolvedValueOnce({ logits: { data: [5.95] } })
      .mockResolvedValueOnce({ logits: { data: [-11.17] } });

    const reranker = new TransformersJsReranker();
    const result = await reranker.rerank('query', [candidate({ id: 'relevant' }), candidate({ id: 'irrelevant' })], 5);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('relevant');
    expect(result[0].score).toBeGreaterThan(0.9);
  });

  it('caps results at topK even when more candidates clear the bar', async () => {
    modelMock.mockResolvedValue({ logits: { data: [3] } });
    const candidates = [candidate({ id: 'a' }), candidate({ id: 'b' }), candidate({ id: 'c' })];

    const reranker = new TransformersJsReranker();
    const result = await reranker.rerank('query', candidates, 2);

    expect(result).toHaveLength(2);
  });

  it('loads the model only once across multiple rerank calls', async () => {
    modelMock.mockResolvedValue({ logits: { data: [3] } });
    const reranker = new TransformersJsReranker();

    await reranker.rerank('q1', [candidate()], 5);
    await reranker.rerank('q2', [candidate()], 5);

    expect(fromPretrainedModelMock).toHaveBeenCalledTimes(1);
    expect(fromPretrainedTokenizerMock).toHaveBeenCalledTimes(1);
  });
});
